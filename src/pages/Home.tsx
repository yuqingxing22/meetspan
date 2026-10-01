import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DateTime } from "luxon";
import TimezonePicker from "../components/TimezonePicker";
import Calendar from "../components/Calendar";
import Icon from "../components/Icon";
import InviteQR from "../components/InviteQR";
import {
  buildSlots,
  detectTz,
  enumerateDateRange,
  nextDatesForWeekdays,
  tzInfo,
} from "../lib/slots";
import { hashToken, newAdminToken, newPollId } from "../lib/ids";
import { createPoll } from "../lib/poll";
import { addMyPoll, saveAdminToken } from "../lib/adminStore";
import { isFirebaseConfigured } from "../firebase";
import { useAuthState } from "../lib/useAuthState";
import { copyText, useToast } from "../lib/useToast";
import type { Granularity, PollMeta } from "../lib/types";
import heroArt from "../assets/illustrations/time-management.svg";
import shareArt from "../assets/illustrations/share-link.svg";

type PickMode = "dates" | "weekly";

const WEEKDAYS = [
  { wd: 1, label: "Mon" },
  { wd: 2, label: "Tue" },
  { wd: 3, label: "Wed" },
  { wd: 4, label: "Thu" },
  { wd: 5, label: "Fri" },
  { wd: 6, label: "Sat" },
  { wd: 7, label: "Sun" },
];

const PRESETS = [
  { id: "work", label: "Work hours", start: 9, end: 17 },
  { id: "morning", label: "Mornings", start: 7, end: 12 },
  { id: "afternoon", label: "Afternoons", start: 12, end: 18 },
  { id: "evening", label: "Evenings", start: 18, end: 22 },
] as const;

// Availability is painted in fixed 30-minute blocks — it only captures "when
// are you free". The meeting duration is a separate input the organizer enters
// later, and is only applied when computing overlaps for the summary.
const GRANULARITY_MIN: Granularity = 30;

function hourLabel(h: number): string {
  if (h === 24) return "12:00 AM (next day)";
  return DateTime.fromObject({ hour: h % 24 }).toFormat("h:mm a");
}

/** Compact hour, e.g. 9 → "9 AM", 24 → "12 AM". */
function shortHour(h: number): string {
  return DateTime.fromObject({ hour: h % 24 }).toFormat("h a");
}

export default function Home() {
  const nav = useNavigate();
  const { show, node } = useToast();
  const auth = useAuthState();
  const uid = auth !== "loading" && auth !== "error" ? auth : null;

  const [title, setTitle] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [tz, setTz] = useState(detectTz());
  const [pickMode, setPickMode] = useState<PickMode>("dates");
  const [dates, setDates] = useState<string[]>([]);
  const [lastPick, setLastPick] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  // 0 = the next occurrence of each weekday from today; n = the week n
  // Mondays from now.
  const [weekStart, setWeekStart] = useState(0);
  const [preset, setPreset] = useState<string>("work");
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"" | "invite" | "organizer">("");
  const [showQR, setShowQR] = useState(false);

  const [created, setCreated] = useState<{
    pollId: string;
    token: string;
  } | null>(null);

  const thisMonday = DateTime.now().setZone(tz).startOf("week");

  const resolvedDates = useMemo(() => {
    if (pickMode === "dates") return dates;
    if (weekStart === 0) return nextDatesForWeekdays(weekdays, tz);
    const monday = DateTime.now().setZone(tz).startOf("week").plus({ weeks: weekStart });
    return [...weekdays]
      .sort((a, b) => a - b)
      .map((wd) => monday.plus({ days: wd - 1 }).toISODate()!);
  }, [pickMode, dates, weekdays, weekStart, tz]);

  function pickDay(iso: string, shift: boolean) {
    if (shift && lastPick && lastPick !== iso) {
      const range = enumerateDateRange(lastPick, iso);
      setDates((d) => Array.from(new Set([...d, ...range])).sort());
    } else {
      setDates((d) => (d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso].sort()));
    }
    setLastPick(iso);
  }
  function toggleWeekday(wd: number) {
    setWeekdays((w) => (w.includes(wd) ? w.filter((x) => x !== wd) : [...w, wd].sort()));
  }
  const fmtDate = (iso: string) => DateTime.fromISO(iso).toFormat("ccc, LLL d");

  const dayCount = pickMode === "dates" ? dates.length : weekdays.length;
  const badRange = endHour <= startHour;
  const canCreate =
    isFirebaseConfigured && Boolean(uid) && !badRange && resolvedDates.length > 0 && !busy;

  let createLabel = "Create poll & get link";
  if (busy) createLabel = "Creating…";
  else if (dayCount === 0)
    createLabel = pickMode === "dates" ? "Pick at least one day to continue" : "Pick at least one weekday";
  else if (badRange) createLabel = "Fix the hours to continue";
  else if (isFirebaseConfigured && auth === "loading") createLabel = "Connecting…";

  const zone = tzInfo(tz);
  const dayWord =
    pickMode === "dates"
      ? dayCount === 1 ? "day" : "days"
      : dayCount === 1 ? "weekday" : "weekdays";
  const daysText =
    dayCount === 0
      ? "No days picked yet"
      : `${dayCount} ${dayWord}${pickMode === "weekly" ? ", every week" : ""}`;
  const hoursText = `${shortHour(startHour)} – ${shortHour(endHour)}`;

  const previewCols = resolvedDates.slice(0, 7).map((iso) => {
    const dt = DateTime.fromISO(iso);
    return pickMode === "dates" ? dt.toFormat("ccc d") : dt.toFormat("ccc");
  });
  const previewRows = Math.min(Math.max(endHour - startHour, 0), 12);
  const moreCount = Math.max(0, resolvedDates.length - 7);

  async function handleCreate() {
    if (!canCreate || !uid) return;
    setBusy(true);
    try {
      const slots = buildSlots(resolvedDates, { startHour, endHour }, GRANULARITY_MIN, tz);
      const pollId = newPollId();
      const token = newAdminToken();
      const meta: PollMeta = {
        title: title.trim(),
        createdAt: Date.now(),
        status: "open",
        adminTokenHash: await hashToken(token),
        organizerUid: uid,
        organizerName: organizerName.trim(),
        organizerTz: tz,
        granularityMin: GRANULARITY_MIN,
        dailyWindow: { startHour, endHour },
        dateMode: pickMode === "weekly" ? "weekly" : "specific",
        dates: resolvedDates,
        weekdays: pickMode === "weekly" ? weekdays : [],
        slots,
      };
      await createPoll(pollId, meta);
      saveAdminToken(pollId, token);
      addMyPoll({ pollId, token, title: meta.title, createdAt: meta.createdAt });
      setCreated({ pollId, token });
      window.scrollTo({ top: 0 });
    } catch (e) {
      show(`Could not create poll: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function markCopied(which: "invite" | "organizer") {
    setCopied(which);
    window.setTimeout(() => setCopied((c) => (c === which ? "" : c)), 1600);
  }

  if (created) {
    const base = window.location.href.split("#")[0];
    const participantLink = `${base}#/p/${created.pollId}`;
    const organizerLink = `${base}#/o/${created.pollId}?k=${created.token}`;
    const pollName = title.trim() || "Untitled poll";
    const emailSubject = `MeetSpan organizer link${title ? ` — ${title}` : ""}`;
    const emailBody =
      `Keep this private — it's your key to manage the poll and pick the final time:\n${organizerLink}\n\n` +
      `Participant invite link (this is the one to share):\n${participantLink}`;
    const inviteSubject = `When are you free?${title ? ` ${title}` : ""}`;
    const inviteBody = `Mark when you're free (it shows in your own timezone, no sign-up needed):\n${participantLink}`;
    const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

    return (
      <div className="narrow">
        <div className="created-hero">
          <img src={shareArt} alt="" className="created-art" />
          <h1 className="page-title created-title">
            <span className="check-badge">
              <Icon name="check" size={18} strokeWidth={2.6} />
            </span>
            Your poll is live
          </h1>
          <p className="page-sub">
            {pollName} · {daysText} · {hoursText}
          </p>
        </div>

        <section className="card">
          <h2>Invite your group</h2>
          <p className="hint">Anyone with this link can add their times.</p>
          <div className="linkbox">
            <code>{participantLink}</code>
            <button
              type="button"
              className={`btn btn-sm ${copied === "invite" ? "btn-success" : "btn-primary"}`}
              onClick={() => {
                copyText(participantLink);
                markCopied("invite");
              }}
            >
              {copied === "invite" ? (
                <>
                  <Icon name="check" /> Copied
                </>
              ) : (
                "Copy link"
              )}
            </button>
          </div>
          <div className="btn-row">
            {canShare && (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  navigator.share({ title: pollName, text: inviteBody, url: participantLink }).catch(() => {})
                }
              >
                <Icon name="share" /> Share…
              </button>
            )}
            <a
              className="btn"
              href={`mailto:?subject=${encodeURIComponent(inviteSubject)}&body=${encodeURIComponent(inviteBody)}`}
            >
              <Icon name="mail" /> Email
            </a>
            <button
              type="button"
              className={`btn${showQR ? " btn-on" : ""}`}
              aria-pressed={showQR}
              onClick={() => setShowQR((v) => !v)}
            >
              <Icon name="qr" /> QR code
            </button>
            <Link className="btn btn-link" to={`/p/${created.pollId}`}>
              Preview as a guest <Icon name="arrowRight" />
            </Link>
          </div>
          {showQR && <InviteQR url={participantLink} title={title.trim()} />}
        </section>

        <section className="card">
          <h2 className="with-icon">
            <Icon name="key" size={18} className="icon-warm" />
            Your private organizer link
          </h2>
          <p className="hint">
            Keep this one to yourself. It's how you see results and lock in the
            time. It's saved under <b>Your polls</b> in this browser; email it to
            yourself as a backup (we can't recover it for you).
          </p>
          <div className="btn-row">
            <button
              type="button"
              className={`btn ${copied === "organizer" ? "btn-success" : ""}`}
              onClick={() => {
                copyText(organizerLink);
                markCopied("organizer");
              }}
            >
              {copied === "organizer" ? (
                <>
                  <Icon name="check" /> Copied
                </>
              ) : (
                <>
                  <Icon name="copy" /> Copy private link
                </>
              )}
            </button>
            <a
              className="btn"
              href={`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
            >
              <Icon name="mail" /> Email it to me
            </a>
            <a
              className="btn"
              href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(
                emailSubject
              )}&body=${encodeURIComponent(emailBody)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Gmail
            </a>
          </div>
        </section>

        <div className="created-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setCreated(null);
              setShowQR(false);
              setDates([]);
              setTitle("");
              setLastPick(null);
            }}
          >
            Create another poll
          </button>
          <button
            type="button"
            className="btn btn-dark btn-lg"
            onClick={() => nav(`/o/${created.pollId}?k=${created.token}`)}
          >
            Open my dashboard <Icon name="arrowRight" size={18} />
          </button>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div>
      <div className="hero">
        <div className="hero-text">
          <span className="eyebrow-pill">No sign-up · Free · Every timezone</span>
          <h1 className="hero-title">Find a time that works for everyone</h1>
          <p className="hero-sub">
            Pick some days, share one link, and each person marks when they're
            free in their own timezone. MeetSpan finds the overlap.
          </p>
        </div>
        <img src={heroArt} alt="" className="hero-art" />
      </div>

      {isFirebaseConfigured && auth === "error" && (
        <div className="notice notice-warn">
          Couldn't sign in. Enable <b>Anonymous</b> sign-in in your Firebase
          console (Authentication → Sign-in method → Anonymous), then reload.
        </div>
      )}

      <div className="create-layout">
        <div className="create-main">
          <section className="card">
            <StepHead n={1} title="The basics" />
            <label className="field">
              <span className="field-label">What's the meeting?</span>
              <input
                type="text"
                className="input-lg"
                value={title}
                placeholder="e.g. Weekly research sync"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="row">
              <label className="field">
                <span className="field-label">Your name</span>
                <input
                  type="text"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                />
              </label>
              <div>
                <TimezonePicker value={tz} onChange={setTz} label="Your timezone" />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="step-head-row">
              <StepHead n={2} title="Which days?" />
              <div className="seg" role="group" aria-label="How to pick days">
                <button
                  type="button"
                  className={pickMode === "dates" ? "active" : ""}
                  aria-pressed={pickMode === "dates"}
                  onClick={() => setPickMode("dates")}
                >
                  Specific dates
                </button>
                <button
                  type="button"
                  className={pickMode === "weekly" ? "active" : ""}
                  aria-pressed={pickMode === "weekly"}
                  onClick={() => setPickMode("weekly")}
                >
                  Repeats weekly
                </button>
              </div>
            </div>

            <div className="days-body">
              {pickMode === "dates" ? (
                <div className="daypick">
                  <Calendar selectedDates={new Set(dates)} onDayClick={pickDay} />
                  <div className="daypick-side">
                    <div className="daypick-side-head">
                      <span className="field-label">Selected · {dates.length}</span>
                      {dates.length > 0 && (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => {
                            setDates([]);
                            setLastPick(null);
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {dates.length === 0 ? (
                      <div className="empty-box">
                        Click days on the calendar.
                        <br />
                        They'll show up here.
                      </div>
                    ) : (
                      <div className="chips">
                        {dates.map((d) => (
                          <button
                            type="button"
                            key={d}
                            className="chip on"
                            aria-label={`Remove ${fmtDate(d)}`}
                            onClick={() => setDates((x) => x.filter((y) => y !== d))}
                          >
                            {fmtDate(d)} <Icon name="x" size={14} />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="tip hide-narrow">
                      <Icon name="info" className="icon-brand" />
                      <span>
                        Hold <b>Shift</b> and click a second day to select the
                        whole range in between.
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="hint">
                    For a recurring meeting. Pick the days it can happen; guests
                    see weekday names, not dates.
                  </p>
                  <div className="weekday-tiles">
                    {WEEKDAYS.map((w) => {
                      const on = weekdays.includes(w.wd);
                      return (
                        <button
                          type="button"
                          key={w.wd}
                          className={`weekday-tile${on ? " on" : ""}`}
                          aria-pressed={on}
                          onClick={() => toggleWeekday(w.wd)}
                        >
                          <span>{w.label}</span>
                          <span className="tile-dot" />
                        </button>
                      );
                    })}
                  </div>
                  <div className="row week-extra">
                    <label className="field">
                      <span className="field-label">First week</span>
                      <select
                        value={weekStart}
                        onChange={(e) => setWeekStart(Number(e.target.value))}
                      >
                        <option value={0}>Starting this week</option>
                        {[1, 2, 3].map((n) => (
                          <option key={n} value={n}>
                            Week of {thisMonday.plus({ weeks: n }).toFormat("LLL d")}
                            {n === 1 ? " (next week)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="first-dates">
                      <span className="field-label">First meetings could fall on</span>
                      {resolvedDates.length === 0 ? (
                        <div className="empty-box empty-box-sm">
                          Pick at least one weekday above.
                        </div>
                      ) : (
                        <div className="chips">
                          {[...resolvedDates].sort().map((d) => (
                            <span key={d} className="chip chip-static">
                              {fmtDate(d)}
                            </span>
                          ))}
                          <span className="muted small">then every week</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="card">
            <StepHead n={3} title="What hours?" />
            <div className="preset-grid">
              {PRESETS.map((p) => {
                const on = preset === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    className={`preset${on ? " on" : ""}`}
                    aria-pressed={on}
                    onClick={() => {
                      setPreset(p.id);
                      setStartHour(p.start);
                      setEndHour(p.end);
                    }}
                  >
                    <span className="preset-label">{p.label}</span>
                    <span className="preset-sub">
                      {shortHour(p.start)} – {shortHour(p.end)}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`preset${preset === "custom" ? " on" : ""}`}
                aria-pressed={preset === "custom"}
                onClick={() => setPreset("custom")}
              >
                <span className="preset-label">Custom</span>
                <span className="preset-sub">Set your own</span>
              </button>
            </div>
            {preset === "custom" && (
              <div className="row custom-hours">
                <label className="field">
                  <span className="field-label">From</span>
                  <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">To</span>
                  <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {badRange && (
              <p className="error-text">The end time needs to be after the start time.</p>
            )}
            <div className="tip tip-plain">
              <Icon name="globe" className="icon-brand" />
              <span>
                In your timezone. Guests automatically see these hours converted
                to theirs, in 30-minute blocks.
              </span>
            </div>
          </section>
        </div>

        <aside className="create-aside">
          <div className="card preview-card">
            <div className="eyebrow">Preview</div>
            <div className="preview-title">{title.trim() || "Untitled poll"}</div>
            <ul className="meta-list">
              <li>
                <Icon name="calendar" /> {daysText}
              </li>
              <li>
                <Icon name="clock" /> {hoursText}
              </li>
              <li>
                <Icon name="globe" /> {zone.city} ({zone.abbr})
              </li>
            </ul>
            <div className="mini-grid-box">
              {previewCols.length === 0 ? (
                <div className="mini-grid-empty">Your grid appears here once you pick days</div>
              ) : (
                <>
                  <div className="mini-grid">
                    {previewCols.map((label, i) => (
                      <div key={i} className="mini-col">
                        <span className="mini-col-head">{label}</span>
                        {Array.from({ length: previewRows }, (_, r) => (
                          <span key={r} className="mini-cell" />
                        ))}
                      </div>
                    ))}
                  </div>
                  {moreCount > 0 && <div className="mini-more">+{moreCount} more days</div>}
                </>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              disabled={!canCreate}
              onClick={handleCreate}
            >
              {createLabel}
              {canCreate && <Icon name="arrowRight" size={18} />}
            </button>
            <p className="preview-note">
              You'll get a share link plus a private link to manage the poll. No
              account needed.
            </p>
          </div>
        </aside>
      </div>
      {node}
    </div>
  );
}

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="step-head">
      <span className="step-num">{n}</span>
      <h2>{title}</h2>
    </div>
  );
}
