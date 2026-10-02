import { useState } from "react";
import { DateTime } from "luxon";
import Icon from "./Icon";
import { importFromGoogleCalendar, isCalendarImportConfigured } from "../lib/gcal";
import { t } from "../lib/i18n";

interface Props {
  slots: number[];
  granularityMin: number;
  /** The poll's timezone (weekly slots are shifted in it, so DST is kept). */
  tz: string;
  weekly: boolean;
  selected: Set<number>;
  maybe?: Set<number>;
  onFill: (next: Set<number>, nextMaybe: Set<number>) => void;
  /** Extra sentence shown after an import (e.g. a reminder on My schedule). */
  afterNote?: string;
  /** Receives the slots that clash with the calendar (empty again on Undo). */
  onBusy?: (busy: Set<number>) => void;
}

/**
 * "Import from Google Calendar": marks every slot that doesn't clash with the
 * viewer's calendar as free. Replaces the current marks (with Undo), like
 * "Fill from my schedule". Only free/busy is read.
 */
export default function CalendarImport({ slots, granularityMin, tz, weekly, selected, maybe, onFill, afterNote, onBusy }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{
    prev: Set<number>;
    prevMaybe: Set<number>;
    filled: number;
    weekOf?: string;
  } | null>(null);

  if (!isCalendarImportConfigured) return null;

  async function run() {
    setBusy(true);
    setError("");
    try {
      const r = await importFromGoogleCalendar(slots, granularityMin, tz, weekly);
      setUndo({ prev: new Set(selected), prevMaybe: new Set(maybe), filled: r.free.size, weekOf: r.weekOf });
      onFill(r.free, new Set());
      onBusy?.(new Set(slots.filter((ms) => !r.free.has(ms))));
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Closing the popup isn't an error worth showing.
      if (code !== "popup_closed") setError(t("Couldn't read your Google Calendar. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fill-bar">
      <button type="button" className="btn btn-sm" disabled={busy} onClick={run}>
        <Icon name="calendar" /> {busy ? t("Reading your calendar…") : t("Import from Google Calendar")}
      </button>
      {error ? (
        <span className="fill-note error-text" role="alert">
          {error}
        </span>
      ) : undo ? (
        <span className="fill-note" role="status">
          {t(
            undo.filled === 1
              ? "Marked 1 slot that's open on your calendar."
              : "Marked {n} slots that are open on your calendar.",
            { n: undo.filled }
          )}{" "}
          {undo.weekOf &&
            t("Based on the week of {date}.", { date: DateTime.fromISO(undo.weekOf).toFormat("LLL d") })}{" "}
          {afterNote && `${afterNote} `}
          <button
            type="button"
            className="link-btn link-inline"
            onClick={() => {
              onFill(undo.prev, undo.prevMaybe);
              onBusy?.(new Set());
              setUndo(null);
            }}
          >
            {t("Undo")}
          </button>
        </span>
      ) : (
        <span className="fill-note">
          {t("Marks the times your calendar is open. Only free/busy is read, never event details.")}
        </span>
      )}
    </div>
  );
}
