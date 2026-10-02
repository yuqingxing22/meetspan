import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DateTime } from "luxon";
import TimezonePicker from "../components/TimezonePicker";
import Calendar from "../components/Calendar";
import DateField from "../components/DateField";
import RepeatEndField from "../components/RepeatEndField";
import { repeatEndError, repeatEndLabel } from "../lib/repeat";
import Icon from "../components/Icon";
import InviteQR from "../components/InviteQR";
import TitleInput from "../components/TitleInput";
import {
  buildSlots,
  detectTz,
  enumerateDateRange,
  nextDatesForWeekdays,
  tzInfo,
} from "../lib/slots";
import { hashToken, newAdminToken, newPollId } from "../lib/ids";
import { createPoll } from "../lib/poll";
import { addMyPoll, loadMyName, saveAdminToken, saveMyName } from "../lib/adminStore";
import { rememberTitle } from "../lib/titleHistory";
import { isFirebaseConfigured, signInWithGoogle } from "../firebase";
import { useAuthState } from "../lib/useAuthState";
import { googleFirstName, useUser } from "../lib/useUser";
import { copyText, useToast } from "../lib/useToast";
import { emailOrganizerLink, mailerEnabled } from "../lib/mailer";
import type { Granularity, PollMeta, RepeatEnd } from "../lib/types";
import heroArt from "../assets/illustrations/time-management.svg";
import shareArt from "../assets/illustrations/share-link.svg";
import { getLang, t } from "../lib/i18n";

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
  if (h === 24) return t("12:00 AM (next day)");
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
  const [deadline, setDeadline] = useState("");
  const [organizerName, setOrganizerName] = useState(loadMyName);
  const [tz, setTz] = useState(detectTz());
  const [pickMode, setPickMode] = useState<PickMode>("dates");
  const [dates, setDates] = useState<string[]>([]);
  const [lastPick, setLastPick] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  // "" = the next occurrence of each weekday from today; otherwise any day in
  // the week the meeting starts.
  const [firstWeek, setFirstWeek] = useState("");
  const [repeatEnd, setRepeatEnd] = useState<RepeatEnd | undefined>(undefined);
  const [preset, setPreset] = useState<string>("work");
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"" | "invite" | "organizer">("");
  const user = useUser();
  const [mailState, setMailState] = useState<"idle" | "sending" | "failed" | { to: string }>("idle");
  const [shareOpen, setShareOpen] = useState(false);
  // No name typed before on this browser: start from the Google first name.
  const googleName = googleFirstName(user);
  useEffect(() => {
    if (googleName) setOrganizerName((n) => n || googleName);
  }, [googleName]);

  const [created, setCreated] = useState<{
    pollId: string;
    token: string;
  } | null>(null);


  const resolvedDates = useMemo(() => {
    if (pickMode === "dates") return dates;
    const monday = firstWeek ? DateTime.fromISO(firstWeek, { zone: tz }).startOf("week") : null;
    if (!monday || monday <= DateTime.now().setZone(tz).startOf("week"))
      return nextDatesForWeekdays(weekdays, tz);
    return [...weekdays]
      .sort((a, b) => a - b)
      .map((wd) => monday.plus({ days: wd - 1 }).toISODate()!);
  }, [pickMode, dates, weekdays, firstWeek, tz]);

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
  const endError =
    pickMode === "weekly" ? repeatEndError(repeatEnd, [...resolvedDates].sort()[0]) : "";
  const canCreate =
    isFirebaseConfigured && Boolean(uid) && !badRange && !endError && resolvedDates.length > 0 && !busy;

  let createLabel = t("Create poll & get link");
  if (busy) createLabel = t("Creating…");
  else if (dayCount === 0)
    createLabel = pickMode === "dates" ? t("Pick at least one day to continue") : t("Pick at least one weekday");
  else if (badRange) createLabel = t("Fix the hours to continue");
  else if (endError) createLabel = t("Fix the end date to continue");
  else if (isFirebaseConfigured && auth === "loading") createLabel = t("Connecting…");

  const zone = tzInfo(tz);
  const daysText =
    dayCount === 0
      ? t("No days picked yet")
      : pickMode === "dates"
      ? t(dayCount === 1 ? "1 day" : "{n} days", { n: dayCount })
      : t(dayCount === 1 ? "1 weekday, every week" : "{n} weekdays, every week", { n: dayCount });
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
        ...(deadline ? { deadline } : {}),
        ...(pickMode === "weekly" && repeatEnd ? { repeatEnd } : {}),
        lang: getLang(),
      };
      await createPoll(pollId, meta);
      saveAdminToken(pollId, token);
      addMyPoll({ pollId, token, title: meta.title, createdAt: meta.createdAt });
      rememberTitle(meta.title);
      saveMyName(meta.organizerName);
      setCreated({ pollId, token });
      window.scrollTo({ top: 0 });
    } catch (e) {
      show(t("Could not create poll: {msg}", { msg: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  function markCopied(which: "invite" | "organizer") {
    setCopied(which);
    window.setTimeout(() => setCopied((c) => (c === which ? "" : c)), 1600);
  }

  // The private organizer link is emailed automatically to a Google-signed-in
  // organizer (anonymous visitors have no address we could use).
  const canEmailMe = mailerEnabled && !!user && !user.isAnonymous;
  useEffect(() => {
    if (!created || !canEmailMe || mailState !== "idle") return;
    setMailState("sending");
    emailOrganizerLink(created.pollId, created.token)
      .then((to) => setMailState({ to }))
      .catch(() => setMailState("failed"));
  }, [created, canEmailMe, mailState]);

  if (created) {
    const base = window.location.href.split("#")[0];
    const participantLink = `${base}#/p/${created.pollId}`;
    const organizerLink = `${base}#/o/${created.pollId}?k=${created.token}`;
    const pollName = title.trim() || t("Untitled poll");
    const inviteSubject = `${t("When are you free?")}${title ? ` ${title}` : ""}`;
    const inviteBody = `${t("Mark when you're free (it shows in your own timezone, no sign-up needed):")}\n${participantLink}`;
    const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

    function share() {
      if (canShare) {
        navigator.share({ title: pollName, text: inviteBody, url: participantLink }).catch(() => {});
      } else {
        setShareOpen((v) => !v);
      }
    }

    let mailNote: React.ReactNode;
    if (mailState === "sending") {
      mailNote = <div className="notice notice-info">{t("Emailing your private link to you…")}</div>;
    } else if (typeof mailState === "object") {
      mailNote = (
        <div className="notice notice-ok">
          <Icon name="check" />
          <span>
            {t("MeetSpan emailed this link to {email}. It usually arrives within a minute or two; if you don't see it, check your spam folder.", {
              email: mailState.to,
            })}
          </span>
        </div>
      );
    } else if (mailState === "failed") {
      mailNote = (
        <div className="notice notice-warn notice-row">
          <span>{t("We couldn't email the link. Copy it and keep it somewhere safe.")}</span>
          <button type="button" className="btn btn-sm" onClick={() => setMailState("idle")}>
            {t("Try again")}
          </button>
        </div>
      );
    } else if (mailerEnabled) {
      mailNote = (
        <div className="notice notice-info notice-row">
          <span>{t("Sign in with Google and MeetSpan will email you this link. Or copy it and keep it somewhere safe.")}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => signInWithGoogle().catch(() => show(t("Sign-in failed")))}
          >
            <Icon name="user" /> {t("Sign in with Google")}
          </button>
        </div>
      );
    }

    return (
      <div className="narrow">
        <div className="created-hero">
          <img src={shareArt} alt="" className="created-art" />
          <h1 className="page-title created-title">
            <span className="check-badge">
              <Icon name="check" size={18} strokeWidth={2.6} />
            </span>
            {t("Your poll is live")}
          </h1>
          <p className="page-sub">
            {pollName} · {daysText} · {hoursText}
          </p>
        </div>

        <section className="card">
          <div className="card-head-row">
            <div>
              <h2>{t("Invite your group")}</h2>
              <p className="hint">{t("Anyone with this link can add their times.")}</p>
            </div>
            <div className="share-wrap">
              <button
                type="button"
                className="btn btn-primary"
                aria-expanded={canShare ? undefined : shareOpen}
                onClick={share}
              >
                <Icon name="share" /> {t("Share")}
              </button>
              {shareOpen && !canShare && (
                <div className="share-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      copyText(`${inviteBody}`);
                      setShareOpen(false);
                      show(t("Invite message copied"));
                    }}
                  >
                    <Icon name="copy" /> {t("Copy invite message")}
                  </button>
                  <a
                    role="menuitem"
                    href={`mailto:?subject=${encodeURIComponent(inviteSubject)}&body=${encodeURIComponent(inviteBody)}`}
                    onClick={() => setShareOpen(false)}
                  >
                    <Icon name="mail" /> {t("Email")}
                  </a>
                  <a
                    role="menuitem"
                    href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(
                      inviteSubject
                    )}&body=${encodeURIComponent(inviteBody)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShareOpen(false)}
                  >
                    <Icon name="mail" /> Gmail
                  </a>
                </div>
              )}
            </div>
          </div>
          <div className="invite-body">
            <div className="invite-main">
              <div className="linkbox">
                <code>{participantLink}</code>
                <button
                  type="button"
                  className={`btn btn-sm ${copied === "invite" ? "btn-success" : ""}`}
                  onClick={() => {
                    copyText(participantLink);
                    markCopied("invite");
                  }}
                >
                  {copied === "invite" ? (
                    <>
                      <Icon name="check" /> {t("Copied")}
                    </>
                  ) : (
                    t("Copy link")
                  )}
                </button>
              </div>
              <Link className="preview-link" to={`/p/${created.pollId}`}>
                {t("Preview as a guest")} <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            <InviteQR url={participantLink} title={title.trim()} compact />
          </div>
        </section>

        <section className="card">
          <h2 className="with-icon">
            <Icon name="key" size={18} className="icon-warm" />
            {t("Your private organizer link")}
          </h2>
          <p className="hint">
            {t("Keep this one to yourself. It's how you see results and lock in the time. It's also saved under “Your polls” in this browser.")}
          </p>
          <div className="linkbox">
            <code>{`${base}#/o/${created.pollId}?k=••••••••`}</code>
            <span
              className="tip-wrap tip-end"
              data-tip={t("Save this link somewhere safe: it's the only key to manage your poll, and we can't recover it for you.")}
            >
              <button
                type="button"
                className={`btn btn-sm ${copied === "organizer" ? "btn-success" : ""}`}
                onClick={() => {
                  copyText(organizerLink);
                  markCopied("organizer");
                }}
              >
                {copied === "organizer" ? (
                  <>
                    <Icon name="check" /> {t("Copied")}
                  </>
                ) : (
                  <>
                    <Icon name="copy" /> {t("Copy private link")}
                  </>
                )}
              </button>
            </span>
          </div>
          {mailNote}
        </section>

        <div className="created-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setCreated(null);
              setMailState("idle");
              setShareOpen(false);
              setDates([]);
              setTitle("");
              setLastPick(null);
            }}
          >
            {t("Create another poll")}
          </button>
          <button
            type="button"
            className="btn btn-dark btn-lg"
            onClick={() => nav(`/o/${created.pollId}?k=${created.token}&view=times`)}
          >
            {t("Next: add my own times")} <Icon name="arrowRight" size={18} />
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
          <span className="eyebrow-pill">{t("No sign-up · Free · Every timezone")}</span>
          <h1 className="hero-title">{t("Find a time that works for everyone")}</h1>
          <p className="hero-sub">
            {t("Pick some days, share one link, and each person marks when they're free in their own timezone. MeetSpan finds the overlap.")}
          </p>
        </div>
        <img src={heroArt} alt="" className="hero-art" />
      </div>

      {isFirebaseConfigured && auth === "error" && (
        <div className="notice notice-warn">
          {t("Couldn't sign in. Enable Anonymous sign-in in your Firebase console (Authentication → Sign-in method → Anonymous), then reload.")}
        </div>
      )}

      <div className="create-layout">
        <div className="create-main">
          <section className="card">
            <StepHead n={1} title={t("The basics")} />
            {/* A div, not a label: clicks in the suggestion list must not refocus the input. */}
            <div className="field">
              <label className="field-label" htmlFor="poll-title">{t("What's the meeting?")}</label>
              <TitleInput id="poll-title" value={title} onChange={setTitle} placeholder={t("e.g. Weekly research sync")} />
            </div>
            <div className="row">
              <label className="field">
                <span className="field-label">{t("Your name")}</span>
                <input
                  type="text"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                />
              </label>
              <div>
                <TimezonePicker value={tz} onChange={setTz} label={t("Your timezone")} />
              </div>
            </div>
            <div className="field field-narrow">
              <label className="field-label" htmlFor="poll-deadline">{t("Respond by (optional)")}</label>
              <DateField id="poll-deadline" value={deadline} onChange={setDeadline} />
            </div>
          </section>

          <section className="card">
            <div className="step-head-row">
              <StepHead n={2} title={t("Which days?")} />
              <div className="seg" role="group" aria-label={t("How to pick days")}>
                <button
                  type="button"
                  className={pickMode === "dates" ? "active" : ""}
                  aria-pressed={pickMode === "dates"}
                  onClick={() => setPickMode("dates")}
                >
                  {t("Specific dates")}
                </button>
                <button
                  type="button"
                  className={pickMode === "weekly" ? "active" : ""}
                  aria-pressed={pickMode === "weekly"}
                  onClick={() => setPickMode("weekly")}
                >
                  {t("Repeats weekly")}
                </button>
              </div>
            </div>

            <div className="days-body">
              {pickMode === "dates" ? (
                <div className="daypick">
                  <Calendar selectedDates={new Set(dates)} onDayClick={pickDay} />
                  <div className="daypick-side">
                    <div className="daypick-side-head">
                      <span className="field-label">{t("Selected · {n}", { n: dates.length })}</span>
                      {dates.length > 0 && (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => {
                            setDates([]);
                            setLastPick(null);
                          }}
                        >
                          {t("Clear")}
                        </button>
                      )}
                    </div>
                    {dates.length === 0 ? (
                      <div className="empty-box">
                        {t("Click days on the calendar.")}
                        <br />
                        {t("They'll show up here.")}
                      </div>
                    ) : (
                      <div className="chips">
                        {dates.map((d) => (
                          <button
                            type="button"
                            key={d}
                            className="chip on"
                            aria-label={t("Remove {name}", { name: fmtDate(d) })}
                            onClick={() => setDates((x) => x.filter((y) => y !== d))}
                          >
                            {fmtDate(d)} <Icon name="x" size={14} />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="tip hide-narrow">
                      <Icon name="info" className="icon-brand" />
                      <span>{t("Hold Shift and click a second day to select the whole range in between.")}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="hint">
                    {t("For a recurring meeting. Pick the days it can happen; guests see weekday names, not dates.")}
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
                          <span>{t(w.label)}</span>
                          <span className="tile-dot" />
                        </button>
                      );
                    })}
                  </div>
                  <div className="row week-extra">
                    <div className="field">
                      <label className="field-label" htmlFor="first-week">{t("First week")}</label>
                      <DateField
                        id="first-week"
                        value={firstWeek}
                        onChange={setFirstWeek}
                        placeholder={t("Starting this week")}
                        format={(iso) =>
                          t("Week of {date}", {
                            date: DateTime.fromISO(iso, { zone: tz }).startOf("week").toFormat("LLL d, yyyy"),
                          })
                        }
                      />
                    </div>
                    <RepeatEndField
                      value={repeatEnd}
                      onChange={setRepeatEnd}
                      firstDate={[...resolvedDates].sort()[0]}
                    />
                  </div>
                  <div className="row week-extra">
                    <div className="first-dates">
                      <span className="field-label">{t("First meetings could fall on")}</span>
                      {resolvedDates.length === 0 ? (
                        <div className="empty-box empty-box-sm">
                          {t("Pick at least one weekday above.")}
                        </div>
                      ) : (
                        <div className="chips">
                          {[...resolvedDates].sort().map((d) => (
                            <span key={d} className="chip chip-static">
                              {fmtDate(d)}
                            </span>
                          ))}
                          <span className="muted small">
                            {t("then every week")}
                            {repeatEnd && !endError ? `${getLang() === "zh" ? "，" : ", "}${repeatEndLabel(repeatEnd)}` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="card">
            <StepHead n={3} title={t("What hours?")} />
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
                    <span className="preset-label">{t(p.label)}</span>
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
                <span className="preset-label">{t("Custom")}</span>
                <span className="preset-sub">{t("Set your own")}</span>
              </button>
            </div>
            {preset === "custom" && (
              <div className="row custom-hours">
                <label className="field">
                  <span className="field-label">{t("From")}</span>
                  <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">{t("To")}</span>
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
              <p className="error-text">{t("The end time needs to be after the start time.")}</p>
            )}
            <div className="tip tip-plain">
              <Icon name="globe" className="icon-brand" />
              <span>
                {t("In your timezone. Guests automatically see these hours converted to theirs, in 30-minute blocks.")}
              </span>
            </div>
          </section>
        </div>

        <aside className="create-aside">
          <div className="card preview-card">
            <div className="eyebrow">{t("Preview")}</div>
            <div className="preview-title">{title.trim() || t("Untitled poll")}</div>
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
                <div className="mini-grid-empty">{t("Your grid appears here once you pick days")}</div>
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
                  {moreCount > 0 && <div className="mini-more">{t("+{n} more days", { n: moreCount })}</div>}
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
              {t("You'll get a share link plus a private link to manage the poll. No account needed.")}
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
