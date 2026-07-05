import { useState } from "react";
import { DateTime } from "luxon";

interface Props {
  /** ISO dates (yyyy-mm-dd) to render as selected/highlighted. */
  selectedDates: Set<string>;
  onDayClick: (iso: string) => void;
  /** Marks range endpoints differently (optional). */
  endpoints?: Set<string>;
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/** Lightweight month calendar with prev/next nav. Past days are disabled. */
export default function Calendar({ selectedDates, onDayClick, endpoints }: Props) {
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
          className="cal-nav"
          onClick={() => canGoPrev && setView(view.minus({ months: 1 }))}
          disabled={!canGoPrev}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="cal-title">{view.toFormat("LLLL yyyy")}</span>
        <button
          type="button"
          className="cal-nav"
          onClick={() => setView(view.plus({ months: 1 }))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="cal-grid">
        {DOW.map((d, i) => (
          <div key={i} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((dt, i) => {
          if (!dt) return <div key={i} className="cal-day empty" />;
          const iso = dt.toISODate()!;
          const disabled = dt < today;
          const sel = selectedDates.has(iso);
          const cls = [
            "cal-day",
            disabled ? "disabled" : "",
            sel ? "sel" : "",
            endpoints?.has(iso) ? "endpoint" : "",
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
              onClick={() => onDayClick(iso)}
            >
              {dt.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
