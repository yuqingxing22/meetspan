import { useState } from "react";
import { DateTime } from "luxon";
import Calendar from "./Calendar";
import DateField from "./DateField";
import Icon from "./Icon";
import { buildSlots, enumerateDateRange } from "../lib/slots";
import { updatePoll } from "../lib/poll";
import type { PollMeta } from "../lib/types";
import { t } from "../lib/i18n";

const WEEKDAYS = [
  { wd: 1, label: "Mon" },
  { wd: 2, label: "Tue" },
  { wd: 3, label: "Wed" },
  { wd: 4, label: "Thu" },
  { wd: 5, label: "Fri" },
  { wd: 6, label: "Sat" },
  { wd: 7, label: "Sun" },
];

function hourLabel(h: number): string {
  if (h === 24) return t("12:00 AM (next day)");
  return DateTime.fromObject({ hour: h % 24 }).toFormat("h:mm a");
}

interface Props {
  pollId: string;
  meta: PollMeta;
  /** How many people have answered (to warn before changing times). */
  responses: number;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

/** Organizer settings after creation: title, deadline, expected people, days and hours. */
export default function EditPollModal({ pollId, meta, responses, onClose, onSaved }: Props) {
  const weekly = meta.dateMode === "weekly";
  const [title, setTitle] = useState(meta.title);
  const [deadline, setDeadline] = useState(meta.deadline ?? "");
  const [expected, setExpected] = useState((meta.expected ?? []).join("\n"));
  const [dates, setDates] = useState<string[]>(meta.dates);
  const [lastPick, setLastPick] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>(meta.weekdays);
  const [startHour, setStartHour] = useState(meta.dailyWindow.startHour);
  const [endHour, setEndHour] = useState(meta.dailyWindow.endHour);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Weekly polls keep their first week; changed weekdays map onto it.
  const firstMonday = DateTime.fromISO([...meta.dates].sort()[0] ?? DateTime.now().toISODate()!, {
    zone: meta.organizerTz,
  }).startOf("week");
  const resolvedDates = weekly
    ? [...weekdays].sort((a, b) => a - b).map((wd) => firstMonday.plus({ days: wd - 1 }).toISODate()!)
    : [...dates].sort();

  const timesChanged =
    startHour !== meta.dailyWindow.startHour ||
    endHour !== meta.dailyWindow.endHour ||
    resolvedDates.join() !== [...meta.dates].sort().join();
  const badRange = endHour <= startHour;
  const canSave = !busy && !badRange && resolvedDates.length > 0;

  function pickDay(iso: string, shift: boolean) {
    if (shift && lastPick && lastPick !== iso) {
      const range = enumerateDateRange(lastPick, iso);
      setDates((d) => Array.from(new Set([...d, ...range])).sort());
    } else {
      setDates((d) => (d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso].sort()));
    }
    setLastPick(iso);
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      const patch: Parameters<typeof updatePoll>[1] = {
        title: title.trim(),
        deadline,
        expected: expected
          .split(/[\n,]/)
          .map((n) => n.trim())
          .filter(Boolean),
      };
      if (timesChanged) {
        patch.dates = resolvedDates;
        patch.weekdays = weekly ? weekdays : [];
        patch.dailyWindow = { startHour, endHour };
        patch.slots = buildSlots(
          resolvedDates,
          { startHour, endHour },
          meta.granularityMin,
          meta.organizerTz
        );
      }
      await updatePoll(pollId, patch);
      onSaved(t("Poll updated"));
      onClose();
    } catch (e) {
      setError(t("Couldn't save: {msg}", { msg: (e as Error).message }));
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={t("Edit poll")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{t("Edit poll")}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <Icon name="x" /> {t("Close")}
          </button>
        </div>

        <label className="field">
          <span className="field-label">{t("Meeting name")}</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div className="row">
          <div className="field">
            <label className="field-label" htmlFor="poll-deadline">{t("Respond by (optional)")}</label>
            <DateField id="poll-deadline" value={deadline} onChange={setDeadline} />
          </div>
          <label className="field">
            <span className="field-label">{t("Who should respond? (optional)")}</span>
            <textarea
              rows={3}
              value={expected}
              placeholder={t("One name per line, e.g.\nAlex\nMei")}
              onChange={(e) => setExpected(e.target.value)}
            />
          </label>
        </div>
        <p className="hint">
          {t("With names listed, the dashboard shows who hasn't responded yet (matched by the name they enter).")}
        </p>

        <div className="divider" />

        <div className="field-label">{weekly ? t("Days of the week") : t("Days")}</div>
        {weekly ? (
          <div className="weekday-tiles edit-weekdays">
            {WEEKDAYS.map((w) => {
              const on = weekdays.includes(w.wd);
              return (
                <button
                  type="button"
                  key={w.wd}
                  className={`weekday-tile${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() =>
                    setWeekdays((x) => (x.includes(w.wd) ? x.filter((y) => y !== w.wd) : [...x, w.wd]))
                  }
                >
                  <span>{t(w.label)}</span>
                  <span className="tile-dot" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="daypick">
            <Calendar selectedDates={new Set(dates)} onDayClick={pickDay} />
            <div className="daypick-side">
              <span className="field-label">{t("Selected · {n}", { n: dates.length })}</span>
              <div className="chips">
                {[...dates].sort().map((d) => (
                  <button
                    type="button"
                    key={d}
                    className="chip on"
                    aria-label={t("Remove {name}", { name: d })}
                    onClick={() => setDates((x) => x.filter((y) => y !== d))}
                  >
                    {DateTime.fromISO(d).toFormat("ccc, LLL d")} <Icon name="x" size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="row edit-hours">
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
        {badRange && <p className="error-text">{t("The end time needs to be after the start time.")}</p>}
        {timesChanged && responses > 0 && (
          <div className="notice notice-warn">
            {t(
              responses === 1
                ? "1 person has already answered. Their marks stay for times you keep; times you remove are dropped, and new times start empty, so you may want to ask them to check again."
                : "{n} people have already answered. Their marks stay for times you keep; times you remove are dropped, and new times start empty, so you may want to ask them to check again.",
              { n: responses }
            )}
          </div>
        )}
        {error && <p className="error-text">{error}</p>}

        <div className="btn-row modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={save}>
            {busy ? t("Saving…") : t("Save changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
