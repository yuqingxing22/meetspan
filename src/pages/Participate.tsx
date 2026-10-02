import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { DateTime } from "luxon";
import AvailabilityBoard from "../components/AvailabilityBoard";
import TimezonePicker from "../components/TimezonePicker";
import ScheduleFill from "../components/ScheduleFill";
import CalendarImport from "../components/CalendarImport";
import Icon from "../components/Icon";
import { detectTz, formatRange, formatSlot, tzInfo } from "../lib/slots";
import {
  setParticipantEmail,
  subscribeParticipants,
  subscribePoll,
  upsertParticipant,
} from "../lib/poll";
import { loadParticipant, saveParticipant } from "../lib/adminStore";
import { newParticipantId } from "../lib/ids";
import { bestWindow } from "../lib/best";
import { avatarColor, initial } from "../lib/avatar";
import { comfortLabel, windowComfort } from "../lib/comfort";
import { finalizedSessions } from "../lib/finalized";
import { buildICS, downloadICS, googleCalendarLink } from "../lib/ics";
import { isFirebaseConfigured } from "../firebase";
import { useAuthState } from "../lib/useAuthState";
import { useMySchedule } from "../lib/useMySchedule";
import type { Participant, PollMeta } from "../lib/types";
import { getLang, t } from "../lib/i18n";

type SaveState = "idle" | "saving" | "saved" | "error";

// Remount per poll so switching polls (e.g. from "Your polls") never carries
// one poll's state into another.
export default function ParticipateRoute() {
  const { pollId = "" } = useParams();
  return <Participate key={pollId} />;
}

function Participate() {
  const { pollId = "" } = useParams();
  const auth = useAuthState();
  const uid = auth !== "loading" && auth !== "error" ? auth : null;
  const stored = useMemo(() => loadParticipant(pollId), [pollId]);

  const [meta, setMeta] = useState<PollMeta | null | undefined>(undefined);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pid, setPid] = useState<string>(stored?.id ?? "");
  const [codename, setCodename] = useState(stored?.codename ?? "");
  const [email, setEmail] = useState(stored?.email ?? "");
  const [tz, setTz] = useState(stored?.tz ?? detectTz());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [maybe, setMaybe] = useState<Set<number>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(stored ? "saved" : "idle");
  const [focusMs, setFocusMs] = useState<number | null>(null);
  const inited = useRef(false);
  const { user } = useMySchedule();

  // Signed in with Google and no name yet: suggest their first name.
  useEffect(() => {
    if (codename || !user || user.isAnonymous || !user.displayName) return;
    setCodename(user.displayName.split(" ")[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  // What the private email doc last held, so it's only rewritten on change.
  const savedEmailKey = useRef(stored ? `${stored.email ?? ""}|${stored.codename}` : "");

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
      setMaybe(new Set(mine.maybeSlots ?? []));
      inited.current = true;
    }
  }, [participants, pid]);

  const closed = meta?.status === "closed";

  async function save() {
    const name = codename.trim();
    if (!uid || !name || !meta) return;
    const id = pid || newParticipantId();
    const mail = email.trim();
    setPid(id);
    inited.current = true;
    setDirty(false);
    setSaveState("saving");
    saveParticipant(pollId, { id, codename: name, tz, email: mail });
    try {
      await upsertParticipant(pollId, {
        id,
        codename: name,
        tz,
        ownerUid: uid,
        selectedSlots: [...selected],
        maybeSlots: [...maybe],
        updatedAt: Date.now(),
      });
      const key = `${mail}|${name}`;
      if (key !== savedEmailKey.current) {
        await setParticipantEmail(pollId, uid, mail, name);
        savedEmailKey.current = key;
      }
      setSaveState("saved");
    } catch (e) {
      console.error("Save failed", e);
      setSaveState("error");
    }
  }

  // Autosave shortly after the last edit, once we know who this is.
  useEffect(() => {
    if (!dirty || closed || !uid || !codename.trim()) return;
    const t = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, selected, maybe, codename, tz, email, uid, closed]);

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.codename ?? "someone";
  const others = participants.filter((p) => p.id !== pid);
  const meIn = selected.size > 0 || maybe.size > 0 || participants.some((p) => p.id === pid);
  const meName = codename.trim() || t("You");

  // Everyone, with the viewer's live selection standing in for their saved copy.
  const everyone = useMemo(() => {
    const list = others.map((p) => ({
      id: p.id,
      name: p.codename,
      tz: p.tz,
      slots: new Set(p.selectedSlots),
      maybe: new Set(p.maybeSlots ?? []),
      isMe: false,
    }));
    if (meIn)
      list.push({ id: pid || "me", name: t("{name} (you)", { name: meName }), tz, slots: selected, maybe, isMe: true });
    return list;
  }, [others, meIn, pid, meName, tz, selected, maybe]);

  const best = useMemo(() => {
    if (!meta) return null;
    const k = Math.max(1, Math.round(60 / meta.granularityMin));
    return bestWindow(meta.slots, meta.granularityMin, everyone, k);
  }, [meta, everyone]);

  if (!isFirebaseConfigured) {
    return <p className="muted">{t("Firebase isn't configured yet (see README).")}</p>;
  }
  if (auth === "error")
    return (
      <div className="card state-card">
        <h2>{t("Couldn't sign in")}</h2>
        <p className="hint">
          {t("This poll needs Anonymous sign-in, which the site owner hasn't enabled yet. Please try again later.")}
        </p>
      </div>
    );
  if (auth === "loading") return <p className="muted">{t("Signing you in…")}</p>;
  if (meta === undefined) return <p className="muted">{t("Loading…")}</p>;
  if (meta === null)
    return (
      <div className="card state-card">
        <h2>{t("Poll not found")}</h2>
        <p className="hint">{t("This invite link may be wrong or the poll was removed.")}</p>
      </div>
    );

  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  const datesLabel =
    meta.dateMode === "weekly"
      ? t("{days}, every week", {
          days: meta.weekdays
            .map((w) => DateTime.fromObject({ weekday: w as 1 }).toFormat("ccc"))
            .join(getLang() === "zh" ? "、" : ", "),
        })
      : meta.dates.length > 1
      ? `${DateTime.fromISO(meta.dates[0]).toFormat("ccc, LLL d")} – ${DateTime.fromISO(
          meta.dates[meta.dates.length - 1]
        ).toFormat("ccc, LLL d")}`
      : meta.dates.length === 1
      ? DateTime.fromISO(meta.dates[0]).toFormat("cccc, LLL d")
      : "";
  const respondedCount = others.length + (meIn ? 1 : 0);
  const finalSessions = finalizedSessions(meta, participants);
  const deadlinePassed =
    !!meta.deadline && DateTime.now().setZone(tz).toISODate()! > meta.deadline;
  const finalTitle = meta.finalized?.meetingName || meta.title || t("Meeting");

  let status: { text: string; tone: string } = { text: t("Mark your free times below"), tone: "idle" };
  if (saveState === "error") status = { text: t("Couldn't save"), tone: "warn" };
  else if (dirty && !codename.trim()) status = { text: t("Add your name to save"), tone: "warn" };
  else if (saveState === "saving" || dirty) status = { text: t("Saving…"), tone: "busy" };
  else if (saveState === "saved") status = { text: t("Saved automatically"), tone: "ok" };

  return (
    <div>
      <div className="page-head">
        <div className="invited-by">
          <span className="avatar avatar-sm" style={{ background: avatarColor(meta.organizerUid) }}>
            {initial(meta.organizerName || "M")}
          </span>
          <span>{t("{name} invited you", { name: meta.organizerName || t("Someone") })}</span>
        </div>
        <h1 className="page-title">{meta.title || t("When are you free?")}</h1>
        <p className="page-sub">
          {datesLabel}
          {datesLabel ? " · " : ""}
          {t(respondedCount === 1 ? "1 person has responded" : "{n} people have responded", { n: respondedCount })}
          {meta.deadline && (
            <>
              {" · "}
              <span className={deadlinePassed ? "deadline passed" : "deadline"}>
                {t(deadlinePassed ? "Deadline was {date}" : "Please respond by {date}", {
                  date: DateTime.fromISO(meta.deadline).toFormat("cccc, LLL d"),
                })}
              </span>
            </>
          )}
        </p>
      </div>

      {finalSessions.length > 0 && (
        <div className="locked-banner final-card">
          <span className="locked-icon">
            <Icon name="check" size={18} strokeWidth={2.6} />
          </span>
          <div className="locked-text">
            <div className="final-eyebrow">{t("The time is set")}</div>
            {finalSessions.map((s) => (
              <div key={s.startMs} className="locked-title">
                {formatRange(s.startMs, s.endMs, tz, meta.dateMode === "weekly")}
              </div>
            ))}
            <div className="locked-sub">
              {finalTitle} · {t("in your timezone")}
              {meta.dateMode === "weekly" ? ` · ${t("repeats every week")}` : ""}
            </div>
          </div>
          <div className="btn-row final-actions">
            {finalSessions.map((s, i) => (
              <a
                key={s.startMs}
                className="btn btn-on-dark"
                href={googleCalendarLink(
                  finalTitle,
                  s.startMs,
                  s.endMs,
                  meta.organizerName
                    ? t("Scheduled with MeetSpan by {name}.", { name: meta.organizerName })
                    : t("Scheduled with MeetSpan."),
                  meta.dateMode === "weekly"
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="calendar" />
                {finalSessions.length > 1 ? `Google Calendar · ${i + 1}` : t("Add to Google Calendar")}
              </a>
            ))}
            <button
              type="button"
              className="btn btn-ghost-dark"
              onClick={() =>
                downloadICS(
                  `${finalTitle.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "meeting"}.ics`,
                  buildICS(
                    {
                      meta,
                      meetingName: finalTitle,
                      sessions: finalSessions,
                      participants,
                      recurring: meta.dateMode === "weekly",
                    },
                    Date.now()
                  )
                )
              }
            >
              <Icon name="download" /> .ics
            </button>
          </div>
        </div>
      )}

      {closed && finalSessions.length === 0 && (
        <div className="notice notice-warn">
          {t("This poll is closed, so your times are read-only now.")}
        </div>
      )}

      <div className="identity-bar">
        <label className="inline-field">
          <span>{t("Responding as")}</span>
          <input
            type="text"
            value={codename}
            placeholder={t("Your name")}
            disabled={closed}
            onChange={(e) => edit(setCodename)(e.target.value)}
          />
        </label>
        <div className="inline-tz">
          <TimezonePicker value={tz} onChange={edit(setTz)} label={t("Times shown in")} />
        </div>
        <label className="inline-field">
          <span>{t("Email")}</span>
          <input
            type="email"
            value={email}
            placeholder={t("Optional, for the final time")}
            disabled={closed}
            onChange={(e) => edit(setEmail)(e.target.value)}
          />
        </label>
        {!closed && (
          <div className={`save-pill ${status.tone}`} role="status">
            <span className="dot" />
            {status.text}
            {saveState === "error" && (
              <button type="button" className="link-btn" onClick={() => void save()}>
                {t("Try again")}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="poll-layout">
        <section className="card poll-main">
          {!closed && (
            <div className="fill-box">
              <ScheduleFill
                slots={meta.slots}
                selected={selected}
                maybe={maybe}
                onFill={(next, nextMaybe) => {
                  setSelected(next);
                  setMaybe(nextMaybe);
                  setDirty(true);
                }}
              />
              <CalendarImport
                slots={meta.slots}
                granularityMin={meta.granularityMin}
                tz={meta.organizerTz}
                weekly={meta.dateMode === "weekly"}
                selected={selected}
                maybe={maybe}
                onFill={(next, nextMaybe) => {
                  setSelected(next);
                  setMaybe(nextMaybe);
                  setDirty(true);
                }}
              />
            </div>
          )}
          <AvailabilityBoard
            slots={meta.slots}
            tz={tz}
            weekdayOnly={meta.dateMode === "weekly"}
            selected={selected}
            maybe={maybe}
            onChange={(next, nextMaybe) => {
              if (closed) return;
              setSelected(next);
              if (nextMaybe) setMaybe(nextMaybe);
              setDirty(true);
            }}
            editable={!closed}
            participants={participants}
            myId={pid}
            nameOf={nameOf}
            focusMs={focusMs}
            onFocusSlot={setFocusMs}
          />
        </section>

        <aside className="poll-side">
          {focusMs !== null && (
            <div className="card side-card">
              <div className="eyebrow">{t("Who's free")}</div>
              <div className="side-title">{formatSlot(focusMs, tz, meta.dateMode === "weekly")}</div>
              <div className="side-sub">
                {t("{n} of {total} free", { n: everyone.filter((p) => p.slots.has(focusMs)).length, total: everyone.length })}
              </div>
              <ul className="people">
                {everyone.map((p) => {
                  const free = p.slots.has(focusMs);
                  const ifNeeded = !free && p.maybe.has(focusMs);
                  const local = DateTime.fromMillis(focusMs, { zone: p.tz });
                  const sameZone = p.tz === tz;
                  const comfort = windowComfort(focusMs, focusMs + 30 * 60_000, p.tz);
                  return (
                    <li key={p.id}>
                      <span className="avatar" style={{ background: p.isMe ? "#14151A" : avatarColor(p.id) }}>
                        {initial(p.name)}
                      </span>
                      <span className="people-main">
                        <span className="people-name">{p.name}</span>
                        <span className="people-sub">
                          {sameZone
                            ? t("Same timezone as you")
                            : t("{time} in {city}", { time: local.toFormat("h:mm a ccc"), city: tzInfo(p.tz).city })}
                          {comfort !== "day" && (
                            <span className={`comfort comfort-${comfort}`}>
                              {comfort === "night" && <Icon name="moon" size={12} />}
                              {comfortLabel(focusMs, p.tz, comfort)}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className={`badge ${free ? "badge-ok" : ifNeeded ? "badge-brand" : "badge-muted"}`}>
                        {free ? t("Free") : ifNeeded ? t("If needed") : t("Busy")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="card side-card">
            <div className="eyebrow">{t("Best 1-hour slot so far")}</div>
            {best ? (
              <>
                <div className="side-title">{formatRange(best.startMs, best.endMs, tz, meta.dateMode === "weekly")}</div>
                <div className="bar">
                  <span style={{ width: `${(best.freeIds.length / Math.max(everyone.length, 1)) * 100}%` }} />
                </div>
                <div className="side-sub">
                  {t("{n} of {total} people free", { n: best.freeIds.length, total: everyone.length })}
                </div>
              </>
            ) : (
              <div className="side-sub">{t("No overlap yet. It shows up as people mark their times.")}</div>
            )}
          </div>

          <div className="card side-card">
            <div className="eyebrow">{t("Responded · {n}", { n: everyone.length })}</div>
            {everyone.length === 0 ? (
              <div className="side-sub">{t("Nobody yet. You could be first.")}</div>
            ) : (
              <ul className="people">
                {everyone.map((p) => (
                  <li key={p.id}>
                    <span className="avatar" style={{ background: p.isMe ? "#14151A" : avatarColor(p.id) }}>
                      {initial(p.name)}
                    </span>
                    <span className="people-name people-main">{p.name}</span>
                    <span className="people-sub">{tzInfo(p.tz).city}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
