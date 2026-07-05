import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import AvailabilityBoard from "../components/AvailabilityBoard";
import TimezonePicker from "../components/TimezonePicker";
import { detectTz } from "../lib/slots";
import {
  setParticipantEmail,
  subscribeParticipants,
  subscribePoll,
  upsertParticipant,
} from "../lib/poll";
import { loadParticipant, saveParticipant } from "../lib/adminStore";
import { newParticipantId } from "../lib/ids";
import { isFirebaseConfigured } from "../firebase";
import { useAuthState } from "../lib/useAuthState";
import { useToast } from "../lib/useToast";
import type { Participant, PollMeta } from "../lib/types";

export default function Participate() {
  const { pollId = "" } = useParams();
  const { show, node } = useToast();
  const auth = useAuthState();
  const uid = typeof auth === "string" ? auth : null;
  const stored = loadParticipant(pollId);

  const [meta, setMeta] = useState<PollMeta | null | undefined>(undefined);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [phase, setPhase] = useState<"intro" | "grid">(
    stored ? "grid" : "intro"
  );
  const [pid, setPid] = useState<string>(stored?.id ?? "");
  const [codename, setCodename] = useState(stored?.codename ?? "");
  const [email, setEmail] = useState(stored?.email ?? "");
  const [tz, setTz] = useState(stored?.tz ?? detectTz());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const inited = useRef(false);

  useEffect(() => {
    // Wait for anonymous sign-in — Firestore rules require an authed user.
    if (!isFirebaseConfigured || !pollId || !uid) return;
    const unsubA = subscribePoll(pollId, setMeta);
    const unsubB = subscribeParticipants(pollId, setParticipants);
    return () => {
      unsubA();
      unsubB();
    };
  }, [pollId, uid]);

  // Initialize the grid from this participant's existing submission (once).
  useEffect(() => {
    if (inited.current || !pid) return;
    const mine = participants.find((p) => p.id === pid);
    if (mine) {
      setSelected(new Set(mine.selectedSlots));
      inited.current = true;
    }
  }, [participants, pid]);

  if (!isFirebaseConfigured) {
    return <p className="muted">Firebase isn't configured yet (see README).</p>;
  }
  if (auth === "error")
    return (
      <div className="card">
        <h2>Couldn't sign in</h2>
        <p className="hint">
          This poll needs Anonymous sign-in, which the site owner hasn't enabled
          yet. Please try again later.
        </p>
      </div>
    );
  if (auth === "loading") return <p className="muted">Signing you in…</p>;
  if (meta === undefined) return <p className="muted">Loading…</p>;
  if (meta === null)
    return (
      <div className="card">
        <h2>Poll not found</h2>
        <p className="hint">This invite link may be wrong or the poll was removed.</p>
      </div>
    );

  const closed = meta.status === "closed";
  const others = participants.filter((p) => p.id !== pid);
  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.codename ?? "someone";

  async function start() {
    const name = codename.trim();
    if (!name) {
      show("Please enter a codename first");
      return;
    }
    if (!uid) {
      show("Still signing in — try again in a moment");
      return;
    }
    const id = pid || newParticipantId();
    const mail = email.trim();
    setPid(id);
    saveParticipant(pollId, { id, codename: name, tz, email: mail });
    inited.current = true;
    try {
      await upsertParticipant(pollId, {
        id,
        codename: name,
        tz,
        ownerUid: uid,
        selectedSlots: [...selected],
        updatedAt: Date.now(),
      });
      await setParticipantEmail(pollId, uid, mail, name);
    } catch (e) {
      show(`Could not join: ${(e as Error).message}`);
      return;
    }
    setPhase("grid");
  }

  async function save() {
    if (!uid) {
      show("Still signing in — try again in a moment");
      return;
    }
    setSaving(true);
    try {
      const mail = email.trim();
      saveParticipant(pollId, { id: pid, codename, tz, email: mail });
      await upsertParticipant(pollId, {
        id: pid,
        codename,
        tz,
        ownerUid: uid,
        selectedSlots: [...selected],
        updatedAt: Date.now(),
      });
      await setParticipantEmail(pollId, uid, mail, codename);
      setDirty(false);
      show("Availability saved ✓");
    } catch (e) {
      show(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  if (phase === "intro") {
    return (
      <div>
        <h1 className="page-title">
          You're invited{meta.title ? `: ${meta.title}` : ""}
        </h1>
        <p className="page-sub">
          Pick a codename, confirm your timezone, then mark when you're free.
        </p>
        <div className="card">
          <label className="field">
            <span className="field-label">Your codename</span>
            <input
              type="text"
              value={codename}
              placeholder="e.g. Nightowl, Alex, 小明…"
              onChange={(e) => setCodename(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
              autoFocus
            />
          </label>
          <TimezonePicker value={tz} onChange={setTz} label="Your timezone" />
          <label className="field">
            <span className="field-label">Email (optional)</span>
            <input
              type="email"
              value={email}
              placeholder="you@example.com — so the organizer can send you the final time"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
            />
          </label>
          {others.length > 0 && (
            <p className="muted">
              Already responded:{" "}
              {others.map((o) => o.codename).join(", ")}
            </p>
          )}
          <div className="spacer" />
          <button className="btn btn-primary btn-block" onClick={start}>
            Start marking availability →
          </button>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">
        Hi {codename} 👋{meta.title ? ` · ${meta.title}` : ""}
      </h1>
      <p className="page-sub">
        Paint the times you're free on the left; the group's overlap updates
        live on the right. Everything's shown in your timezone.
      </p>

      {closed && (
        <div className="banner banner-warn" style={{ borderRadius: 8 }}>
          This poll is closed — your selections are read-only now.
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <TimezonePicker
            value={tz}
            onChange={(z) => {
              setTz(z);
              setDirty(true);
            }}
            label="Viewing in timezone"
          />
          <label className="field">
            <span className="field-label">Email (optional)</span>
            <input
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => {
                setEmail(e.target.value);
                setDirty(true);
              }}
            />
          </label>
        </div>

        <AvailabilityBoard
          slots={meta.slots}
          tz={tz}
          weekdayOnly={meta.dateMode === "weekly"}
          selected={selected}
          onChange={(next) => {
            if (closed) return;
            setSelected(next);
            setDirty(true);
          }}
          editable={!closed}
          participants={participants}
          myId={pid}
          nameOf={nameOf}
        />

        <div className="spacer" />
        <div className="row">
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={closed || saving || !dirty}
          >
            {saving ? "Saving…" : dirty ? "Save my availability" : "Saved ✓"}
          </button>
          {others.length > 0 && (
            <div className="participant-tags" style={{ alignSelf: "center" }}>
              {others.map((o) => (
                <span key={o.id} className="tag">
                  {o.codename}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {node}
    </div>
  );
}
