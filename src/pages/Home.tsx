import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DateTime } from "luxon";
import TimezonePicker from "../components/TimezonePicker";
import Calendar from "../components/Calendar";
import {
  buildSlots,
  detectTz,
  enumerateDateRange,
  nextDatesForWeekdays,
} from "../lib/slots";
import { hashToken, newAdminToken, newPollId } from "../lib/ids";
import { createPoll } from "../lib/poll";
import {
  addMyPoll,
  listMyPolls,
  removeMyPoll,
  saveAdminToken,
  type MyPoll,
} from "../lib/adminStore";
import { isFirebaseConfigured } from "../firebase";
import { useAuthState } from "../lib/useAuthState";
import { copyText, useToast } from "../lib/useToast";
import type { Granularity, PollMeta } from "../lib/types";

type PickMode = "specific" | "range" | "weekly";

const WEEKDAYS = [
  { wd: 1, label: "Mon" },
  { wd: 2, label: "Tue" },
  { wd: 3, label: "Wed" },
  { wd: 4, label: "Thu" },
  { wd: 5, label: "Fri" },
  { wd: 6, label: "Sat" },
  { wd: 7, label: "Sun" },
];

// Availability is painted in fixed 30-minute blocks — it only captures "when
// are you free". The meeting duration is a separate input the organizer enters
// later, and is only applied when computing overlaps for the summary.
const GRANULARITY_MIN: Granularity = 30;

function hourLabel(h: number): string {
  if (h === 24) return "12:00 AM (next day)";
  return DateTime.fromObject({ hour: h % 24 }).toFormat("h:mm a");
}

export default function Home() {
  const nav = useNavigate();
  const { show, node } = useToast();
  const auth = useAuthState();
  const uid = typeof auth === "string" ? auth : null;

  const [title, setTitle] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [tz, setTz] = useState(detectTz());
  const [pickMode, setPickMode] = useState<PickMode>("specific");
  const [dates, setDates] = useState<string[]>([]);
  const [datesConfirmed, setDatesConfirmed] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [rangeConfirmed, setRangeConfirmed] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [busy, setBusy] = useState(false);
  const [myPolls, setMyPolls] = useState<MyPoll[]>(listMyPolls());

  const [created, setCreated] = useState<{
    pollId: string;
    token: string;
  } | null>(null);

  function forgetPoll(pollId: string) {
    removeMyPoll(pollId);
    setMyPolls(listMyPolls());
  }

  const rangeDates = useMemo(() => {
    if (rangeStart && rangeEnd) return enumerateDateRange(rangeStart, rangeEnd);
    if (rangeStart) return [rangeStart];
    return [];
  }, [rangeStart, rangeEnd]);

  const resolvedDates = useMemo(() => {
    if (pickMode === "specific") return dates;
    if (pickMode === "range") return rangeDates;
    return nextDatesForWeekdays(weekdays, tz);
  }, [pickMode, dates, rangeDates, weekdays, tz]);

  function changeMode(m: PickMode) {
    setPickMode(m);
    setDatesConfirmed(false);
    setRangeConfirmed(false);
  }
  function toggleSpecific(iso: string) {
    setDates((d) =>
      d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso].sort()
    );
  }
  const fmtDate = (iso: string) => DateTime.fromISO(iso).toFormat("ccc, LLL d");
  function handleRangeClick(iso: string) {
    // First click (or restart) sets the start; second click sets the end.
    if (!rangeStart || rangeEnd) {
      setRangeStart(iso);
      setRangeEnd(null);
    } else if (iso >= rangeStart) {
      setRangeEnd(iso);
    } else {
      setRangeStart(iso); // clicked earlier than start → move the start
    }
  }
  function toggleWeekday(wd: number) {
    setWeekdays((w) =>
      w.includes(wd) ? w.filter((x) => x !== wd) : [...w, wd].sort()
    );
  }

  const canCreate =
    isFirebaseConfigured &&
    Boolean(uid) &&
    endHour > startHour &&
    resolvedDates.length > 0 &&
    !busy;

  async function handleCreate() {
    if (!canCreate || !uid) return;
    setBusy(true);
    try {
      const slots = buildSlots(
        resolvedDates,
        { startHour, endHour },
        GRANULARITY_MIN,
        tz
      );
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
        // "range" is just concrete dates like "specific" for display/grid purposes.
        dateMode: pickMode === "weekly" ? "weekly" : "specific",
        dates: resolvedDates,
        weekdays: pickMode === "weekly" ? weekdays : [],
        slots,
      };
      await createPoll(pollId, meta);
      saveAdminToken(pollId, token);
      addMyPoll({ pollId, token, title: meta.title, createdAt: meta.createdAt });
      setCreated({ pollId, token });
    } catch (e) {
      show(`Could not create poll: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const base = window.location.href.split("#")[0];
    const participantLink = `${base}#/p/${created.pollId}`;
    const organizerLink = `${base}#/o/${created.pollId}?k=${created.token}`;
    const emailSubject = `MeetSpan organizer link${title ? ` — ${title}` : ""}`;
    const emailBody =
      `Keep this private — it's your key to manage the poll and pick the final time:\n${organizerLink}\n\n` +
      `Participant invite link (this is the one to share):\n${participantLink}`;
    const mailtoHref = `mailto:?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;
    const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;
    return (
      <div>
        <h1 className="page-title">Poll created 🎉</h1>
        <p className="page-sub">
          Share the participant link with everyone. Keep the organizer link
          private — it's your key to close the poll and pick the time.
        </p>

        <div className="card">
          <h2>Participant invite link</h2>
          <p className="hint">Anyone with this link can add their availability.</p>
          <LinkRow
            value={participantLink}
            onCopy={() => {
              copyText(participantLink);
              show("Invite link copied");
            }}
          />
        </div>

        <div className="card">
          <h2>Your organizer link 🔑</h2>
          <p className="hint">
            Private — this is your key to control the poll. Email it to yourself
            so you never lose access (we can't recover it for you). It's also
            saved in “Your polls” on the home page of this browser.
          </p>
          <LinkRow
            value={organizerLink}
            onCopy={() => {
              copyText(organizerLink);
              show("Organizer link copied");
            }}
          />
          <div className="field-label" style={{ marginTop: 16 }}>
            Email this link to yourself
          </div>
          <div className="compose-links">
            <a
              className="btn"
              href={gmailHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              Gmail
            </a>
            <a className="btn" href={mailtoHref}>
              Default mail app
            </a>
          </div>
          <div className="spacer" />
          <button
            className="btn btn-primary"
            onClick={() => nav(`/o/${created.pollId}?k=${created.token}`)}
          >
            Open organizer view →
          </button>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Schedule across timezones</h1>
      <p className="page-sub">
        Create a poll, share the link, and everyone paints when they're free —
        in their own timezone. No sign-up needed.
      </p>

      {isFirebaseConfigured && auth === "error" && (
        <div className="banner banner-warn" style={{ borderRadius: 8 }}>
          Couldn't sign in. Enable <b>Anonymous</b> sign-in in your Firebase
          console (Authentication → Sign-in method → Anonymous), then reload.
        </div>
      )}

      {myPolls.length > 0 && (
        <div className="card">
          <h2>Your polls</h2>
          <p className="hint">
            Polls you created in this browser. Click to manage — no link needed.
          </p>
          <div className="mypolls">
            {myPolls.map((p) => (
              <div key={p.pollId} className="mypoll">
                <button
                  className="mypoll-open"
                  onClick={() => nav(`/o/${p.pollId}?k=${p.token}`)}
                >
                  <span className="mypoll-title">
                    {p.title || "Untitled poll"}
                  </span>
                  <span className="mypoll-date">
                    {DateTime.fromMillis(p.createdAt).toFormat("LLL d, yyyy")}
                  </span>
                </button>
                <button
                  className="mypoll-forget"
                  title="Remove from this list (doesn't delete the poll)"
                  onClick={() => forgetPoll(p.pollId)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>1 · About you</h2>
        <div className="row">
          <label className="field">
            <span className="field-label">Your name / codename</span>
            <input
              type="text"
              value={organizerName}
              placeholder="e.g. Kyra"
              onChange={(e) => setOrganizerName(e.target.value)}
            />
          </label>
          <TimezonePicker value={tz} onChange={setTz} label="Your timezone" />
        </div>
        <label className="field">
          <span className="field-label">What's this for? (optional)</span>
          <input
            type="text"
            value={title}
            placeholder="e.g. Weekly research sync"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </div>

      <div className="card">
        <h2>2 · Which days?</h2>
        <div className="seg" role="tablist">
          <button
            className={pickMode === "specific" ? "active" : ""}
            onClick={() => changeMode("specific")}
          >
            Pick dates
          </button>
          <button
            className={pickMode === "range" ? "active" : ""}
            onClick={() => changeMode("range")}
          >
            Date range
          </button>
          <button
            className={pickMode === "weekly" ? "active" : ""}
            onClick={() => changeMode("weekly")}
          >
            Days of the week
          </button>
        </div>
        <div className="spacer" />

        {pickMode === "specific" &&
          (datesConfirmed ? (
            <div className="daypick-confirmed">
              <span>
                <b className="ok">✓</b> {dates.length} day
                {dates.length === 1 ? "" : "s"} selected:{" "}
                {dates.map(fmtDate).join(", ")}
              </span>
              <button
                className="btn btn-sm"
                onClick={() => setDatesConfirmed(false)}
              >
                Edit
              </button>
            </div>
          ) : (
            <>
              <p className="hint">Click any days you want to consider.</p>
              <div className="daypick">
                <Calendar
                  selectedDates={new Set(dates)}
                  onDayClick={toggleSpecific}
                />
                <div className="daypick-side">
                  <div className="field-label">
                    Selected days ({dates.length})
                  </div>
                  {dates.length === 0 ? (
                    <p className="muted">Click days on the calendar →</p>
                  ) : (
                    <div className="chips">
                      {dates.map((d) => (
                        <button
                          key={d}
                          className="chip on"
                          onClick={() => toggleSpecific(d)}
                          title="Remove"
                        >
                          {fmtDate(d)} ✕
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ))}

        {pickMode === "range" &&
          (rangeConfirmed ? (
            <div className="daypick-confirmed">
              <span>
                <b className="ok">✓</b> {rangeDates.length} day
                {rangeDates.length === 1 ? "" : "s"}:{" "}
                {fmtDate(rangeStart!)} → {fmtDate(rangeEnd!)}
              </span>
              <button
                className="btn btn-sm"
                onClick={() => setRangeConfirmed(false)}
              >
                Edit
              </button>
            </div>
          ) : (
            <>
              <p className="hint">
                Click a start day, then an end day — every day in between is
                included.
              </p>
              <div className="daypick">
                <Calendar
                  selectedDates={new Set(rangeDates)}
                  endpoints={
                    new Set([rangeStart, rangeEnd].filter(Boolean) as string[])
                  }
                  onDayClick={handleRangeClick}
                />
                <div className="daypick-side">
                  <div className="field-label">Selected range</div>
                  {!rangeStart ? (
                    <p className="muted">Click the start day on the calendar →</p>
                  ) : !rangeEnd ? (
                    <p className="muted">
                      Start: <b>{fmtDate(rangeStart)}</b>
                      <br />
                      Now click the end day →
                    </p>
                  ) : (
                    <div className="range-summary">
                      <div className="range-line">
                        <b>{fmtDate(rangeStart)}</b>
                        <span className="range-arrow">→</span>
                        <b>{fmtDate(rangeEnd)}</b>
                      </div>
                      <div className="muted">
                        Lasts {rangeDates.length} day
                        {rangeDates.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ))}

        {pickMode === "weekly" && (
          <>
            <p className="hint">
              For recurring meetings. The schedule shows weekday names; behind
              the scenes it uses the upcoming week to compute exact times.
            </p>
            <div className="chips">
              {WEEKDAYS.map((w) => (
                <button
                  key={w.wd}
                  className={`chip${weekdays.includes(w.wd) ? " on" : ""}`}
                  onClick={() => toggleWeekday(w.wd)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </>
        )}

        {pickMode === "specific" && !datesConfirmed && (
          <div className="card-actions">
            <button
              className="btn btn-primary"
              disabled={dates.length === 0}
              onClick={() => setDatesConfirmed(true)}
            >
              Confirm days
            </button>
          </div>
        )}
        {pickMode === "range" && !rangeConfirmed && (
          <div className="card-actions">
            <button
              className="btn btn-primary"
              disabled={!rangeStart || !rangeEnd}
              onClick={() => setRangeConfirmed(true)}
            >
              Confirm days
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>3 · Daily time window</h2>
        <p className="hint">
          The hours to consider each day, in your timezone (
          {tz.replace(/_/g, " ")}). Participants paint availability in 30-minute
          blocks; they see it in their own timezone.
        </p>
        <div className="row">
          <label className="field">
            <span className="field-label">From</span>
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {endHour <= startHour && (
          <p className="muted" style={{ color: "var(--danger)" }}>
            End time must be after the start time.
          </p>
        )}
      </div>

      <button
        className="btn btn-primary btn-block"
        disabled={!canCreate}
        onClick={handleCreate}
      >
        {busy ? "Creating…" : "Create poll & get share link →"}
      </button>
      {node}
    </div>
  );
}

function LinkRow({ value, onCopy }: { value: string; onCopy: () => void }) {
  return (
    <div className="linkbox">
      <code>{value}</code>
      <button className="btn btn-sm btn-primary" onClick={onCopy}>
        Copy
      </button>
    </div>
  );
}
