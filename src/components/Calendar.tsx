import { useState } from "react";
import { DateTime } from "luxon";
import Icon from "./Icon";
import { t } from "../lib/i18n";

interface Props {
  /** ISO dates (yyyy-mm-dd) to render as selected/highlighted. */
  selectedDates: Set<string>;
  /** `shift` is true when the day was Shift-clicked (range selection). */
  onDayClick: (iso: string, shift: boolean) => void;
}

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]; // translated at render

/** Lightweight month calendar with prev/next nav. Past days are disabled. */
export default function Calendar({ selectedDates, onDayClick }: Props) {
  const today = DateTime.now().startOf("day");
  const [view, setView] = useState(today.startOf("month"));

  const first = view.startOf("month");
  const lead = first.weekday % 7; // Sun-first grid: Sun→0 … Sat→6
  const daysInMonth = view.daysInMonth ?? 30;
  const canGoPrev = view.startOf("month") > today.startOf("month");

  const cells: (DateTime | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(view.set({ day: d }));

  return (
    <div className="cal">
      <div className="cal-head">
        <button
          type="button"
          className="icon-btn"
          onClick={() => canGoPrev && setView(view.minus({ months: 1 }))}
          disabled={!canGoPrev}
          aria-label={t("Previous month")}
        >
          <Icon name="chevronLeft" />
        </button>
        <span className="cal-title">{view.toFormat("LLLL yyyy")}</span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setView(view.plus({ months: 1 }))}
          aria-label={t("Next month")}
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {t(d)}
          </div>
        ))}
        {cells.map((dt, i) => {
          if (!dt) return <div key={i} />;
          const iso = dt.toISODate()!;
          const disabled = dt < today;
          const sel = selectedDates.has(iso);
          const cls = [
            "cal-day",
            sel ? "sel" : "",
            iso === today.toISODate() ? "today" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              type="button"
              key={i}
              className={cls}
              disabled={disabled}
              aria-pressed={sel}
              aria-label={dt.toFormat("cccc, LLLL d")}
              onClick={(e) => onDayClick(iso, e.shiftKey)}
            >
              {dt.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
