import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Heatmap, { type SlotStat } from "../components/Heatmap";
import AvailabilityBoard from "../components/AvailabilityBoard";
import ResultPanel from "../components/ResultPanel";
import EmailModal from "../components/EmailModal";
import {
  closePoll,
  finalizePoll,
  reopenPoll,
  subscribeEmails,
  subscribeParticipants,
  subscribePoll,
  upsertParticipant,
  verifyAdmin,
} from "../lib/poll";
import {
  loadAdminToken,
  loadParticipant,
  saveAdminToken,
  saveParticipant,
} from "../lib/adminStore";
import { newParticipantId } from "../lib/ids";
import { computeSchedule, type ComputeResult, type Session } from "../lib/overlap";
import { isFirebaseConfigured } from "../firebase";
import { useAuthState } from "../lib/useAuthState";
import { copyText, useToast } from "../lib/useToast";
import { MEETING_TYPES } from "../lib/types";
import type {
  MeetingType,
  Participant,
  ParticipantEmail,
  PollMeta,
} from "../lib/types";

export default function Organizer() {
  const { pollId = "" } = useParams();
  const [params] = useSearchParams();
  const { show, node } = useToast();
  const auth = useAuthState();
  const uid = typeof auth === "string" ? auth : null;

  const token = params.get("k") ?? loadAdminToken(pollId);

  const [meta, setMeta] = useState<PollMeta | null | undefined>(undefined);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [emails, setEmails] = useState<ParticipantEmail[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [meetingName, setMeetingName] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(1);
  const [type, setType] = useState<MeetingType>("team");

  const [result, setResult] = useState<ComputeResult | null>(null);
  const [chosen, setChosen] = useState<Session[]>([]);
  const [showEmail, setShowEmail] = useState(false);

  // The organizer's own availability — stored as a participant so it counts in
  // the overlap and the computed schedule, just like everyone else.
  const stored = loadParticipant(pollId);
  const [myId, setMyId] = useState(stored?.id ?? "");
  const [mySelected, setMySelected] = useState<Set<number>>(new Set());
  const [availDirty, setAvailDirty] = useState(false);
  const [savingAvail, setSavingAvail] = useState(false);
  const availInited = useRef(false);

  useEffect(() => {
    // Wait for anonymous sign-in — Firestore rules require an authed user.
    if (!isFirebaseConfigured || !pollId || !uid) return;
    if (params.get("k")) saveAdminToken(pollId, params.get("k")!);
    const unsubA = subscribePoll(pollId, setMeta);
    const unsubB = subscribeParticipants(pollId, setParticipants);
    // Only the organizer's uid can read this; others get an empty list.
    const unsubC = subscribeEmails(pollId, setEmails);
    return () => {
      unsubA();
      unsubB();
      unsubC();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId, uid]);

  // Verify the admin token against the stored hash whenever meta loads.
  useEffect(() => {
    if (!meta) return;
    let alive = true;
    verifyAdmin(meta, token).then((ok) => alive && setIsAdmin(ok));
    if (meta.title && !meetingName) setMeetingName(meta.title);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, token]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    participants.forEach((p) => m.set(p.id, p.codename));
    return m;
  }, [participants]);
  const nameOf = (id: string) => nameById.get(id) ?? "someone";

  // Seed the organizer's grid from their existing submission, once.
  useEffect(() => {
    if (availInited.current || !myId) return;
    const mine = participants.find((p) => p.id === myId);
    if (mine) {
      setMySelected(new Set(mine.selectedSlots));
      availInited.current = true;
    }
  }, [participants, myId]);

  const statsByMs = useMemo(() => {
    const m = new Map<number, SlotStat>();
    if (meta) for (const ms of meta.slots) m.set(ms, { count: 0, available: [] });
    for (const p of participants) {
      for (const ms of p.selectedSlots) {
        const s = m.get(ms);
        if (s) {
          s.available.push(p.id);
          s.count++;
        }
      }
    }
    return m;
  }, [meta, participants]);

  if (!isFirebaseConfigured) {
    return <p className="muted">Firebase isn't configured yet (see README).</p>;
  }
  if (auth === "error")
    return (
      <div className="card">
        <h2>Couldn't sign in</h2>
        <p className="hint">
          Enable Anonymous sign-in in your Firebase console (Authentication →
          Sign-in method → Anonymous), then reload.
        </p>
      </div>
    );
  if (auth === "loading") return <p className="muted">Signing you in…</p>;
  if (meta === undefined) return <p className="muted">Loading…</p>;
  if (meta === null)
    return (
      <div className="card">
        <h2>Poll not found</h2>
      </div>
    );

  // Expand each chosen session into the slot starts it covers, to outline
  // them on the heatmap.
  const highlight = new Set<number>();
  const step = meta.granularityMin * 60_000;
  for (const s of chosen) {
    for (let t = s.startMs; t < s.endMs; t += step) highlight.add(t);
  }

  function runCompute() {
    if (!meta) return;
    const res = computeSchedule({
      slots: meta.slots,
      granularityMin: meta.granularityMin,
      participants: participants.map((p) => ({
        id: p.id,
        selectedSlots: p.selectedSlots,
      })),
      durationMin,
      sessionsPerWeek,
    });
    setResult(res);
  }

  async function onUse(sessions: Session[]) {
    setChosen(sessions);
    setShowEmail(true);
    try {
      await finalizePoll(pollId, {
        meetingName,
        durationMin,
        sessionsPerWeek,
        type,
        chosenSlots: sessions.map((s) => s.startMs),
      });
    } catch {
      /* non-fatal — email still works locally */
    }
  }

  async function saveMyAvailability() {
    if (!meta || !uid) return;
    setSavingAvail(true);
    const id = myId || newParticipantId();
    const codename = stored?.codename || meta.organizerName || "Organizer";
    try {
      saveParticipant(pollId, { id, codename, tz: meta.organizerTz });
      await upsertParticipant(pollId, {
        id,
        codename,
        tz: meta.organizerTz,
        ownerUid: uid,
        selectedSlots: [...mySelected],
        updatedAt: Date.now(),
      });
      setMyId(id);
      availInited.current = true;
      setAvailDirty(false);
      show("Your availability saved ✓");
    } catch (e) {
      show(`Save failed: ${(e as Error).message}`);
    } finally {
      setSavingAvail(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          {meta.title || "Meeting poll"}
        </h1>
        <span className={`pill ${meta.status === "open" ? "pill-open" : "pill-closed"}`}>
          {meta.status}
        </span>
      </div>
      <p className="page-sub">
        {participants.length} response{participants.length === 1 ? "" : "s"} ·
        organizer timezone {meta.organizerTz.replace(/_/g, " ")}
      </p>

      {isAdmin === false && (
        <div className="banner banner-warn" style={{ borderRadius: 8 }}>
          You're viewing without the organizer key, so controls are disabled.
          Open your private organizer link to manage this poll.
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2>Availability &amp; overlap</h2>
            <p className="hint" style={{ marginBottom: 0 }}>
              {isAdmin
                ? "Add your own availability, then watch the group overlap fill in — in your timezone."
                : "Darker = more people free. Shown in your timezone."}
            </p>
          </div>
          <div className="row" style={{ flex: "0 0 auto", gap: 8 }}>
            <button
              className="btn btn-sm"
              onClick={() => {
                const base = window.location.href.split("#")[0];
                copyText(`${base}#/p/${pollId}`);
                show("Invite link copied");
              }}
            >
              Copy invite link
            </button>
            {isAdmin &&
              (meta.status === "open" ? (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => closePoll(pollId)}
                >
                  Close poll
                </button>
              ) : (
                <button
                  className="btn btn-sm"
                  onClick={() => reopenPoll(pollId)}
                >
                  Reopen
                </button>
              ))}
          </div>
        </div>

        <div className="divider" />

        {isAdmin ? (
          <>
            {participants.length > 0 && (
              <div className="participant-tags" style={{ marginBottom: 12 }}>
                {participants.map((p) => (
                  <span key={p.id} className="tag">
                    {p.codename} · {p.tz.split("/").pop()?.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
            <AvailabilityBoard
              slots={meta.slots}
              tz={meta.organizerTz}
              weekdayOnly={meta.dateMode === "weekly"}
              selected={mySelected}
              onChange={(next) => {
                if (meta.status !== "open") return;
                setMySelected(next);
                setAvailDirty(true);
              }}
              editable={meta.status === "open"}
              participants={participants}
              myId={myId}
              nameOf={nameOf}
              highlight={highlight}
            />
            {meta.status === "open" && (
              <>
                <div className="spacer" />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={saveMyAvailability}
                  disabled={savingAvail || !availDirty}
                >
                  {savingAvail
                    ? "Saving…"
                    : availDirty
                    ? "Save my availability"
                    : "Saved ✓"}
                </button>
              </>
            )}
          </>
        ) : participants.length === 0 ? (
          <p className="muted">
            No responses yet. Share the invite link and check back here.
          </p>
        ) : (
          <>
            <div className="participant-tags" style={{ marginBottom: 12 }}>
              {participants.map((p) => (
                <span key={p.id} className="tag">
                  {p.codename} · {p.tz.split("/").pop()?.replace(/_/g, " ")}
                </span>
              ))}
            </div>
            <Heatmap
              slots={meta.slots}
              tz={meta.organizerTz}
              weekdayOnly={meta.dateMode === "weekly"}
              total={participants.length}
              statsByMs={statsByMs}
              nameOf={nameOf}
              highlight={highlight}
            />
          </>
        )}
      </div>

      <div className="card">
        <h2>Find the meeting time</h2>
        <p className="hint">
          Enter the meeting details, then let MeetSpan sum the overlap.
        </p>
        <div className="row">
          <label className="field">
            <span className="field-label">Meeting name</span>
            <input
              type="text"
              value={meetingName}
              placeholder="e.g. Research sync"
              onChange={(e) => setMeetingName(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Duration (min)</span>
            <input
              type="number"
              min={meta.granularityMin}
              step={meta.granularityMin}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span className="field-label">Sessions / week</span>
            <input
              type="number"
              min={1}
              max={7}
              value={sessionsPerWeek}
              onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span className="field-label">Meeting type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MeetingType)}
            >
              {MEETING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="btn btn-primary"
          onClick={runCompute}
          disabled={participants.length === 0}
        >
          Find times →
        </button>
      </div>

      {result && (
        <ResultPanel
          result={result}
          meta={meta}
          nameOf={nameOf}
          onUse={onUse}
        />
      )}

      {showEmail && (
        <EmailModal
          meta={meta}
          meetingName={meetingName || meta.title || "Our meeting"}
          durationMin={durationMin}
          sessionsPerWeek={sessionsPerWeek}
          type={type}
          sessions={chosen}
          participants={participants}
          recipientEmails={emails.map((e) => e.email)}
          onClose={() => setShowEmail(false)}
        />
      )}
      {node}
    </div>
  );
}
