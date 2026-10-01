import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { DateTime } from "luxon";
import AvailabilityBoard from "../components/AvailabilityBoard";
import ResultPanel from "../components/ResultPanel";
import EmailModal from "../components/EmailModal";
import Icon from "../components/Icon";
import InviteQR from "../components/InviteQR";
import ScheduleFill from "../components/ScheduleFill";
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
import { computeSchedule, type Session } from "../lib/overlap";
import { formatRange, tzInfo } from "../lib/slots";
import { commonWindows } from "../lib/best";
import { avatarColor, initial } from "../lib/avatar";
import { isFirebaseConfigured } from "../firebase";
import { useAuthState } from "../lib/useAuthState";
import { copyText, useToast } from "../lib/useToast";
import { MEETING_TYPES } from "../lib/types";
import type { MeetingType, Participant, ParticipantEmail, PollMeta } from "../lib/types";
import waitArt from "../assets/illustrations/wait-in-line.svg";

const DURATIONS = [
  { min: 30, label: "30 min" },
  { min: 60, label: "1 hr" },
  { min: 90, label: "1.5 hr" },
  { min: 120, label: "2 hr" },
];

/** Rebuild a Session for a saved start time (e.g. a finalized poll on reload). */
function sessionAt(
  startMs: number,
  durationMin: number,
  meta: PollMeta,
  participants: Participant[]
): Session {
  const step = meta.granularityMin * 60_000;
  const endMs = startMs + durationMin * 60_000;
  const covered: number[] = [];
  for (let t = startMs; t < endMs; t += step) covered.push(t);
  const freeIds = participants
    .filter((p) => covered.every((ms) => p.selectedSlots.includes(ms)))
    .map((p) => p.id);
  return {
    startMs,
    endMs,
    slotCount: covered.length,
    count: freeIds.length,
    freeIds,
    missing: participants.map((p) => p.id).filter((id) => !freeIds.includes(id)),
    blockId: 0,
  };
}

/** Setup progress shown beside the organizer's "my times" view. */
function SetupRail({ hasMine, onDashboard }: { hasMine: boolean; onDashboard: () => void }) {
  return (
    <nav className="setup-rail" aria-label="Setup steps">
      <ol>
        <li className="done">
          <span className="step-dot">
            <Icon name="check" size={14} strokeWidth={3} />
          </span>
          <span className="step-text">
            <b>
              <span className="hide-narrow">Share the invite link</span>
              <span className="only-narrow-inline">Shared</span>
            </b>
            <span>Done when you created the poll. Copy it again from the top right any time.</span>
          </span>
        </li>
        <li className={`current${hasMine ? " done" : ""}`} aria-current="step">
          <span className="step-dot">
            {hasMine ? <Icon name="check" size={14} strokeWidth={3} /> : 2}
          </span>
          <span className="step-text">
            <b>
              <span className="hide-narrow">Add your own times</span>
              <span className="only-narrow-inline">My times</span>
            </b>
            <span>{hasMine ? "Saved. Keep adjusting until it's right." : "Optional. Mark them in the grid."}</span>
          </span>
        </li>
        <li>
          <span className="step-dot">3</span>
          <span className="step-text">
            <button type="button" className="rail-link" onClick={onDashboard}>
              <span className="hide-narrow">See the dashboard</span>
              <span className="only-narrow-inline">Dashboard</span>
              <Icon name="arrowRight" size={14} />
            </button>
            <span>Best times and everyone's overlap. It fills in as people respond.</span>
          </span>
        </li>
      </ol>
    </nav>
  );
}

// Remount per poll so switching polls (e.g. from "Your polls") never carries
// one poll's state into another.
export default function OrganizerRoute() {
  const { pollId = "" } = useParams();
  return <Organizer key={pollId} />;
}

function Organizer() {
  const { pollId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { show, node } = useToast();
  const auth = useAuthState();
  const uid = auth !== "loading" && auth !== "error" ? auth : null;

  const token = params.get("k") ?? loadAdminToken(pollId);

  const [meta, setMeta] = useState<PollMeta | null | undefined>(undefined);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [emails, setEmails] = useState<ParticipantEmail[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [meetingName, setMeetingName] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(1);
  const [type, setType] = useState<MeetingType>("team");

  const [chosen, setChosen] = useState<Session[]>([]);
  const [hoverSessions, setHoverSessions] = useState<Session[] | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  // Start times ticked in the "all times everyone can make it" list.
  const [picks, setPicks] = useState<number[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // The organizer's own availability — stored as a participant so it counts in
  // the overlap and the computed schedule, just like everyone else.
  const stored = useMemo(() => loadParticipant(pollId), [pollId]);
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
    // The poll's creator (same uid, e.g. signed in with Google on another
    // device) is the organizer even without the secret link.
    verifyAdmin(meta, token).then(
      (ok) => alive && setIsAdmin(ok || (!!uid && meta.organizerUid === uid))
    );
    if (meta.title && !meetingName) setMeetingName(meta.title);
    if (meta.finalized) {
      setDurationMin((d) => (d === 60 ? meta.finalized!.durationMin : d));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, token, uid]);

  // Seed the organizer's grid from their existing submission, once.
  useEffect(() => {
    if (availInited.current || !myId) return;
    const mine = participants.find((p) => p.id === myId);
    if (mine) {
      setMySelected(new Set(mine.selectedSlots));
      availInited.current = true;
    }
  }, [participants, myId]);

  // Close the ⋯ menu / QR popover on an outside click.
  useEffect(() => {
    if (!menuOpen && !qrOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
      if (qrRef.current && !qrRef.current.contains(t)) setQrOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, qrOpen]);

  async function saveMyAvailability() {
    if (!meta || !uid) return;
    setSavingAvail(true);
    setAvailDirty(false);
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
    } catch (e) {
      show(`Save failed: ${(e as Error).message}`);
    } finally {
      setSavingAvail(false);
    }
  }

  // Autosave the organizer's own times shortly after the last edit.
  useEffect(() => {
    if (!availDirty) return;
    const t = window.setTimeout(() => void saveMyAvailability(), 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availDirty, mySelected]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    participants.forEach((p) => m.set(p.id, p.codename));
    return m;
  }, [participants]);
  const nameOf = (id: string) => nameById.get(id) ?? "someone";

  // Responses from people other than the organizer. The organizer's own
  // times count toward the overlap, but they don't make the poll "answered":
  // until someone else replies, the page stays in its waiting state.
  const othersCount = participants.filter(
    (p) => p.id !== myId && (!uid || p.ownerUid !== uid)
  ).length;

  // Best times update live as people respond.
  const result = useMemo(() => {
    if (!meta || participants.length === 0) return null;
    return computeSchedule({
      slots: meta.slots,
      granularityMin: meta.granularityMin,
      participants: participants.map((p) => ({ id: p.id, selectedSlots: p.selectedSlots })),
      durationMin,
      sessionsPerWeek,
    });
  }, [meta, participants, durationMin, sessionsPerWeek]);

  // Every window (at this meeting length) where all respondents are free.
  const common = useMemo(() => {
    if (!meta || participants.length === 0) return [];
    const k = Math.max(1, Math.ceil(durationMin / meta.granularityMin));
    return commonWindows(
      meta.slots,
      meta.granularityMin,
      participants.map((p) => ({ id: p.id, slots: new Set(p.selectedSlots) })),
      k
    );
  }, [meta, participants, durationMin]);

  // A new meeting length means different windows: clear the ticks.
  useEffect(() => {
    setPicks([]);
  }, [durationMin]);

  if (!isFirebaseConfigured) {
    return <p className="muted">Firebase isn't configured yet (see README).</p>;
  }
  if (auth === "error")
    return (
      <div className="card state-card">
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
      <div className="card state-card">
        <h2>Poll not found</h2>
        <p className="hint">This link may be wrong or the poll was removed.</p>
      </div>
    );

  // The locked-in time: picked in this session, or saved on the poll.
  const lockedSessions: Session[] =
    chosen.length > 0
      ? chosen
      : meta.finalized
      ? meta.finalized.chosenSlots.map((ms) =>
          sessionAt(ms, meta.finalized!.durationMin, meta, participants)
        )
      : [];
  const lockedDuration = chosen.length > 0 ? durationMin : meta.finalized?.durationMin ?? durationMin;

  const pickedSessions = picks
    .filter((ms) => common.some((w) => w.startMs === ms))
    .sort((a, b) => a - b)
    .map((ms) => sessionAt(ms, durationMin, meta, participants));
  const lockedStarts = new Set(lockedSessions.map((s) => s.startMs));

  // Common windows grouped by day, in the organizer's timezone.
  const commonByDay: { day: string; windows: { startMs: number; endMs: number }[] }[] = [];
  for (const w of common) {
    const day = DateTime.fromMillis(w.startMs, { zone: meta.organizerTz }).toFormat(
      meta.dateMode === "weekly" ? "cccc" : "ccc, LLL d"
    );
    const last = commonByDay[commonByDay.length - 1];
    if (last && last.day === day) last.windows.push(w);
    else commonByDay.push({ day, windows: [w] });
  }
  const shortRange = (w: { startMs: number; endMs: number }) => {
    const a = DateTime.fromMillis(w.startMs, { zone: meta.organizerTz });
    const b = DateTime.fromMillis(w.endMs, { zone: meta.organizerTz });
    return `${a.toFormat(a.toFormat("a") === b.toFormat("a") ? "h:mm" : "h:mm a")} – ${b.toFormat("h:mm a")}`;
  };

  // Outline the previewed (hovered) option, else the ticked ones, else the
  // locked-in time.
  const outlined = hoverSessions ?? (pickedSessions.length > 0 ? pickedSessions : lockedSessions);
  const highlight = new Set<number>();
  const step = meta.granularityMin * 60_000;
  for (const s of outlined) {
    for (let t = s.startMs; t < s.endMs; t += step) highlight.add(t);
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

  function copyInvite() {
    const base = window.location.href.split("#")[0];
    copyText(`${base}#/p/${pollId}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const open = meta.status === "open";
  const canEdit = !!isAdmin && open;
  // Two views of one poll: "times" (the organizer marks their own
  // availability) and the dashboard (results). Kept in the URL so reloads and
  // the back button behave.
  const view: "times" | "dashboard" =
    params.get("view") === "times" && isAdmin !== false && open ? "times" : "dashboard";
  function go(v: "times" | "dashboard") {
    const next = new URLSearchParams(params);
    if (v === "times") next.set("view", "times");
    else next.delete("view");
    setParams(next);
    window.scrollTo({ top: 0 });
  }
  const saveLabel = savingAvail || availDirty ? "Saving…" : myId && mySelected.size > 0 ? "Your times are saved" : "";
  const zone = tzInfo(meta.organizerTz);
  const win = meta.dailyWindow;
  const hoursLabel = `${DateTime.fromObject({ hour: win.startHour % 24 }).toFormat("h a")} – ${DateTime.fromObject({
    hour: win.endHour % 24,
  }).toFormat("h a")}`;
  const datesLabel =
    meta.dateMode === "weekly"
      ? `${meta.weekdays
          .map((w) => DateTime.fromObject({ weekday: w as 1 }).toFormat("ccc"))
          .join(", ")}, weekly`
      : meta.dates.length > 1
      ? `${DateTime.fromISO(meta.dates[0]).toFormat("ccc, LLL d")} – ${DateTime.fromISO(
          meta.dates[meta.dates.length - 1]
        ).toFormat("ccc, LLL d")}`
      : meta.dates.length === 1
      ? DateTime.fromISO(meta.dates[0]).toFormat("cccc, LLL d")
      : "";

  // Header stats.
  const zones = Array.from(new Set(participants.map((p) => p.tz)));
  const offsets = zones
    .map((z) => ({ z, off: DateTime.now().setZone(z).offset }))
    .sort((a, b) => a.off - b.off);
  const spanHours = offsets.length > 1 ? (offsets[offsets.length - 1].off - offsets[0].off) / 60 : 0;
  const topStat = result?.stats.reduce(
    (best, s) => (s.count > best.count ? s : best),
    { ms: 0, count: 0, available: [] as string[] }
  );

  const lockedLabel = lockedSessions
    .map((s) => formatRange(s.startMs, s.endMs, meta.organizerTz))
    .join(" · ");

  return (
    <div>
      <div className="page-head page-head-row page-head-sticky">
        <div>
          <div className="title-row">
            <h1 className="page-title">{meta.title || "Meeting poll"}</h1>
            <span className={`status-pill ${open ? "ok" : "muted"}`}>
              <span className="dot" />
              {open ? "Collecting responses" : "Closed"}
            </span>
          </div>
          <p className="page-sub">
            {datesLabel}
            {datesLabel ? " · " : ""}
            {hoursLabel} · Your timezone: {zone.city} ({zone.abbr})
          </p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className={`btn ${copied ? "btn-success" : ""}`}
            onClick={copyInvite}
            aria-label="Copy invite link"
          >
            <Icon name={copied ? "check" : "copy"} />
            <span className="hide-narrow">{copied ? "Copied" : "Copy invite link"}</span>
          </button>
          <div className="menu-root" ref={qrRef}>
            <button
              type="button"
              className="icon-btn icon-btn-lg"
              aria-label="Show invite QR code"
              aria-expanded={qrOpen}
              onClick={() => setQrOpen((o) => !o)}
            >
              <Icon name="qr" size={18} />
            </button>
            {qrOpen && (
              <div className="menu menu-wide menu-pad">
                <InviteQR
                  url={`${window.location.href.split("#")[0]}#/p/${pollId}`}
                  title={meta.title}
                />
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="menu-root" ref={menuRef}>
              <button
                type="button"
                className="icon-btn icon-btn-lg"
                aria-label="More actions"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <Icon name="more" size={18} />
              </button>
              {menuOpen && (
                <div className="menu">
                  <button
                    type="button"
                    className={`menu-item${open ? " danger" : ""}`}
                    onClick={() => {
                      setMenuOpen(false);
                      (open ? closePoll(pollId) : reopenPoll(pollId)).catch((e) =>
                        show(`Couldn't update the poll: ${(e as Error).message}`)
                      );
                    }}
                  >
                    {open ? "Close poll" : "Reopen poll"}
                  </button>
                </div>
              )}
            </div>
          )}
          {view === "times" ? (
            <button type="button" className="btn btn-primary" onClick={() => go("dashboard")}>
              Dashboard <Icon name="arrowRight" />
            </button>
          ) : (
            canEdit && (
              <button type="button" className="btn btn-dark" onClick={() => go("times")}>
                <Icon name="calendar" />
                {mySelected.size > 0 ? "Edit my times" : "Add my times"}
              </button>
            )
          )}
        </div>
      </div>

      {isAdmin === false && (
        <div className="notice notice-warn">
          You're viewing without the organizer key, so controls are disabled.
          Open your private organizer link to manage this poll.
        </div>
      )}

      {view === "times" ? (
        <div className="times-layout">
          <SetupRail hasMine={mySelected.size > 0} onDashboard={() => go("dashboard")} />
          <section className="card times-main">
            <div className="results-head">
              <h2>Your availability</h2>
              <span className="muted small" role="status">{saveLabel}</span>
            </div>
            {canEdit && (
              <ScheduleFill
                slots={meta.slots}
                selected={mySelected}
                onFill={(next) => {
                  setMySelected(next);
                  setAvailDirty(true);
                }}
              />
            )}
            <AvailabilityBoard
              slots={meta.slots}
              tz={meta.organizerTz}
              weekdayOnly={meta.dateMode === "weekly"}
              selected={mySelected}
              onChange={(next) => {
                if (!canEdit) return;
                setMySelected(next);
                setAvailDirty(true);
              }}
              editable={canEdit}
              paintOnly
              participants={participants}
              myId={myId}
              nameOf={nameOf}
            />
            <div className="times-foot">
              <span className="muted small">
                Your times count toward the overlap, just like everyone else's.
              </span>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => go("dashboard")}>
                Done, see the dashboard <Icon name="arrowRight" size={18} />
              </button>
            </div>
          </section>
        </div>
      ) : (
        <>
          {othersCount === 0 && (
            <div className="notice notice-info">
              <span>
                {participants.length > 0
                  ? "Only your own times so far. The results fill in by themselves as people respond."
                  : "No responses yet. The results fill in by themselves as people respond."}
              </span>
              <button type="button" className={`btn btn-sm ${copied ? "btn-success" : "btn-primary"}`} onClick={copyInvite}>
              {copied ? (
                <>
                  <Icon name="check" /> Copied
                </>
              ) : (
                "Copy invite link"
              )}
            </button>
            </div>
          )}

          {participants.length > 0 && (
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Responses</div>
              <div className="stat-row">
                <span className="stat-value">{participants.length}</span>
                <span className="avatar-stack">
                  {participants.slice(0, 6).map((p) => (
                    <span
                      key={p.id}
                      className="avatar"
                      title={p.codename}
                      style={{ background: avatarColor(p.id) }}
                    >
                      {initial(p.codename)}
                    </span>
                  ))}
                </span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Best overlap</div>
              <div className="stat-value">
                {topStat && topStat.count > 0 ? `${topStat.count} / ${participants.length}` : "–"}
              </div>
              <div className="stat-sub">
                {topStat && topStat.count > 0
                  ? DateTime.fromMillis(topStat.ms, { zone: meta.organizerTz }).toFormat("ccc, LLL d, h:mm a")
                  : "No overlap yet"}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Timezones</div>
              <div className="stat-value">{zones.length}</div>
              <div className="stat-sub">
                {offsets.length > 1
                  ? `${tzInfo(offsets[0].z).city} to ${tzInfo(offsets[offsets.length - 1].z).city} · ${spanHours} hours apart`
                  : zones.length === 1
                  ? `Everyone in ${tzInfo(zones[0]).city}`
                  : ""}
              </div>
            </div>
          </div>
          )}

        {lockedSessions.length > 0 && (
          <div className="locked-banner">
            <span className="locked-icon">
              <Icon name="check" size={18} strokeWidth={2.6} />
            </span>
            <div className="locked-text">
              <div className="locked-title">Locked in: {lockedLabel}</div>
              <div className="locked-sub">
                Send the final time to everyone who left an email, or download a
                calendar invite.
              </div>
            </div>
            <button type="button" className="btn btn-on-dark" onClick={() => setShowEmail(true)}>
              <Icon name="mail" /> Email &amp; calendar invite
            </button>
          </div>
        )}

          <div className="org-layout">
            {result ? (
              <section className="org-results">
                <div className="card">
                  <div className="results-head">
                    <h2>Best times</h2>
                    <div className="seg seg-sm" role="group" aria-label="Meeting length">
                      {DURATIONS.map((d) => (
                        <button
                          type="button"
                          key={d.min}
                          className={durationMin === d.min ? "active" : ""}
                          aria-pressed={durationMin === d.min}
                          onClick={() => setDurationMin(d.min)}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="hint">
                    Updates live as people respond. Hover a card to see it on the grid.
                  </p>
                  <details className="more-settings">
                    <summary>Meeting details</summary>
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
                        <span className="field-label">Sessions per week</span>
                        <select
                          value={sessionsPerWeek}
                          onChange={(e) => setSessionsPerWeek(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n === 1 ? "Once" : `${n} times`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="field-label">Meeting type</span>
                        <select value={type} onChange={(e) => setType(e.target.value as MeetingType)}>
                          {MEETING_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </details>
                </div>
                <ResultPanel
                  result={result}
                  meta={meta}
                  participants={participants}
                  nameOf={nameOf}
                  onUse={isAdmin ? onUse : () => show("Open your private organizer link to pick a time")}
                  onHover={setHoverSessions}
                  chosenStart={lockedSessions[0]?.startMs ?? null}
                />

                {(common.length > 0 || result.kind === "ok") && (
                  <div className="card common-card">
                    <div className="results-head">
                      <h2>All times everyone can make it</h2>
                      <span className="badge badge-ok">{common.length}</span>
                    </div>
                    <p className="hint">
                      Every {DURATIONS.find((d) => d.min === durationMin)?.label ?? `${durationMin} min`}{" "}
                      slot where all {participants.length} people are free, in your
                      timezone. Tick one or more to lock them in.
                    </p>
                    {commonByDay.map((g) => (
                      <div key={g.day} className="common-day">
                        <div className="common-day-label">{g.day}</div>
                        <div className="chips">
                          {g.windows.map((w) => {
                            const on = picks.includes(w.startMs);
                            const locked = lockedStarts.has(w.startMs);
                            return (
                              <button
                                type="button"
                                key={w.startMs}
                                className={`chip time-chip${on ? " on" : ""}${locked ? " locked" : ""}`}
                                aria-pressed={on}
                                onClick={() =>
                                  setPicks((p) =>
                                    p.includes(w.startMs)
                                      ? p.filter((x) => x !== w.startMs)
                                      : [...p, w.startMs]
                                  )
                                }
                                onMouseEnter={() =>
                                  setHoverSessions([sessionAt(w.startMs, durationMin, meta, participants)])
                                }
                                onMouseLeave={() => setHoverSessions(null)}
                              >
                                {(on || locked) && <Icon name="check" size={14} />}
                                {shortRange(w)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-primary btn-block"
                      disabled={pickedSessions.length === 0}
                      onClick={() => {
                        if (!isAdmin) {
                          show("Open your private organizer link to pick a time");
                          return;
                        }
                        void onUse(pickedSessions);
                        setPicks([]);
                      }}
                    >
                      {pickedSessions.length === 0
                        ? "Tick the times you want"
                        : `Pick ${pickedSessions.length} selected ${
                            pickedSessions.length === 1 ? "time" : "times"
                          }`}
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <section className="org-results">
                <div className="card empty-mini">
                  <img src={waitArt} alt="" />
                  <h2>Waiting for responses</h2>
                  <p>
                    Send the invite link to your group. The best times show up
                    here as soon as people mark when they're free.
                  </p>
                  {canEdit && (
                    <button type="button" className="btn" onClick={() => go("times")}>
                      <Icon name="calendar" /> Add my own times
                    </button>
                  )}
                </div>
              </section>
            )}

            <section className="card org-grid">
              <div className="results-head">
                <h2>Everyone's availability</h2>
              </div>
              <AvailabilityBoard
                slots={meta.slots}
                tz={meta.organizerTz}
                weekdayOnly={meta.dateMode === "weekly"}
                selected={mySelected}
                onChange={() => {}}
                editable={false}
                participants={participants}
                myId={myId}
                nameOf={nameOf}
                highlight={highlight}
              />
            </section>
          </div>
        </>
      )}

      {showEmail && lockedSessions.length > 0 && (
        <EmailModal
          meta={meta}
          meetingName={meetingName || meta.title || "Our meeting"}
          durationMin={lockedDuration}
          sessionsPerWeek={chosen.length > 0 ? sessionsPerWeek : meta.finalized?.sessionsPerWeek ?? 1}
          type={chosen.length > 0 ? type : meta.finalized?.type ?? type}
          sessions={lockedSessions}
          participants={participants}
          recipientEmails={emails.map((e) => e.email)}
          onClose={() => setShowEmail(false)}
        />
      )}
      {node}
    </div>
  );
}
