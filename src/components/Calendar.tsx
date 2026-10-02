import { useMemo, useState } from "react";
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
/** How far ahead the month picker goes. */
const MAX_YEARS_AHEAD = 5;

/**
 * Lightweight month calendar with prev/next nav. Clicking the month title
 * switches to a month picker for jumping months or years ahead. Past days and
 * months are disabled.
 */
export default function Calendar({ selectedDates, onDayClick }: Props) {
  const today = DateTime.now().startOf("day");
  const thisMonth = today.startOf("month");
  const [view, setView] = useState<DateTime>(thisMonth);
  // Month-picker mode shows the 12 months of `pickYear`.
  const [picking, setPicking] = useState(false);
  const [pickYear, setPickYear] = useState(today.year);

  // "yyyy-MM" of every month that has a selected day, for the dots.
  const monthsWithDays = useMemo(
    () => new Set([...selectedDates].map((iso) => iso.slice(0, 7))),
    [selectedDates]
  );

  const first = view.startOf("month");
  const lead = first.weekday % 7; // Sun-first grid: Sun→0 … Sat→6
  const daysInMonth = view.daysInMonth ?? 30;
  const canGoPrev = view.startOf("month") > thisMonth;
  const lastYear = today.year + MAX_YEARS_AHEAD;
  const canGoNext = view.year < lastYear || view.month < 12;

  const cells: (DateTime | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(view.set({ day: d }));

  function openPicker() {
    setPickYear(view.year);
    setPicking(true);
  }

  function pickMonth(m: DateTime) {
    setView(m);
    setPicking(false);
  }

  if (picking) {
    const months = Array.from({ length: 12 }, (_, i) =>
      DateTime.fromObject({ year: pickYear, month: i + 1, day: 1 })
    );
    return (
      <div className="cal">
        <div className="cal-head">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setPickYear((y) => y - 1)}
            disabled={pickYear <= today.year}
            aria-label={t("Previous year")}
          >
            <Icon name="chevronLeft" />
          </button>
          <button
            type="button"
            className="cal-title cal-title-btn"
            onClick={() => setPicking(false)}
            aria-label={t("Back to days")}
          >
            {months[0].toFormat("yyyy")}
            <Icon name="chevronDown" size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setPickYear((y) => y + 1)}
            disabled={pickYear >= lastYear}
            aria-label={t("Next year")}
          >
            <Icon name="chevronRight" />
          </button>
        </div>
        <div className="cal-months">
          {months.map((m) => {
            const key = m.toFormat("yyyy-MM");
            const cls = [
              "cal-month",
              m.hasSame(view, "month") ? "sel" : "",
              m.hasSame(thisMonth, "month") ? "today" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                type="button"
                key={key}
                className={cls}
                disabled={m < thisMonth}
                aria-current={m.hasSame(view, "month") ? "date" : undefined}
                aria-label={m.toFormat("LLLL yyyy")}
                onClick={() => pickMonth(m)}
              >
                {m.toFormat("LLL")}
                {monthsWithDays.has(key) && <span className="cal-month-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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
        <button
          type="button"
          className="cal-title cal-title-btn"
          onClick={openPicker}
          aria-label={t("Choose month and year")}
          title={t("Choose month and year")}
        >
          {view.toFormat("LLLL yyyy")}
          <Icon name="chevronDown" size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => canGoNext && setView(view.plus({ months: 1 }))}
          disabled={!canGoNext}
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

      {!view.hasSame(thisMonth, "month") && (
        <button type="button" className="cal-back" onClick={() => setView(thisMonth)}>
          <Icon name="chevronLeft" size={14} />
          {t("Back to this month")}
        </button>
      )}
    </div>
  );
}
