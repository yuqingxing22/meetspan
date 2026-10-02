import { useState } from "react";
import { DateTime } from "luxon";
import Icon from "./Icon";
import { buildGridModel } from "../lib/slots";
import { t } from "../lib/i18n";

interface Props {
  slots: number[];
  tz: string;
  weekdayOnly?: boolean;
  selected: Set<number>;
  onChange: (next: Set<number>, nextMaybe?: Set<number>) => void;
  /** "If needed" slots; when given, a tap cycles free → if needed → clear. */
  maybe?: Set<number>;
  /** How many *other* people are free at each slot. */
  othersFree: Map<number, number>;
  othersTotal: number;
  /** Slots taken on the viewer's calendar. */
  busy?: Set<number>;
}

/**
 * Phone-sized availability picker: one day at a time, each 30-minute block a
 * full-width tap target, with a small "n/N free" bar for the rest of the group.
 * Avoids drag-painting a wide grid on a touch screen.
 */
export default function DayList({
  slots,
  tz,
  weekdayOnly,
  selected,
  onChange,
  othersFree,
  othersTotal,
  maybe,
  busy,
}: Props) {
  const model = buildGridModel(slots, tz, { weekdayOnly });
  const [day, setDay] = useState(0);
  const col = model.columns[Math.min(day, model.columns.length - 1)];
  if (!col) return null;
  const step = model.rows.length >= 2 ? model.rows[1].key - model.rows[0].key : 30;
  const fmt = (min: number) =>
    DateTime.fromObject({ hour: 0, minute: 0 }).plus({ minutes: min }).toFormat("h:mm a");

  function toggle(ms: number) {
    const next = new Set(selected);
    if (!maybe) {
      if (next.has(ms)) next.delete(ms);
      else next.add(ms);
      onChange(next);
      return;
    }
    const nextMaybe = new Set(maybe);
    if (next.has(ms)) {
      next.delete(ms);
      nextMaybe.add(ms);
    } else if (nextMaybe.has(ms)) {
      nextMaybe.delete(ms);
    } else {
      next.add(ms);
    }
    onChange(next, nextMaybe);
  }

  const isLast = day >= model.columns.length - 1;

  return (
    <div className="daylist">
      <div className="day-tabs" role="tablist" aria-label={t("Days")}>
        {model.columns.map((c, i) => {
          const [dow, date] = c.label.split("\n");
          const has = model.rows.some((r) => {
            const ms = model.cells.get(`${c.key}|${r.key}`);
            return ms !== undefined && selected.has(ms);
          });
          return (
            <button
              type="button"
              role="tab"
              key={c.key}
              aria-selected={i === day}
              className={`day-tab${i === day ? " on" : ""}`}
              onClick={() => setDay(i)}
            >
              <span className="day-tab-dow">{weekdayOnly ? dow.slice(0, 3) : dow}</span>
              {date && <span className="day-tab-date">{date.split(" ")[1]}</span>}
              {has && <span className="day-tab-dot" />}
            </button>
          );
        })}
      </div>

      <div className="daylist-head">
        <span>{maybe ? t("Tap once for free, twice for “if needed”") : t("Tap the times you're free")}</span>
        {othersTotal > 0 && <span>{t("Others free")}</span>}
      </div>
      <div className="daylist-rows">
        {model.rows.map((r) => {
          const ms = model.cells.get(`${col.key}|${r.key}`);
          if (ms === undefined) return null;
          const mine = selected.has(ms);
          const ifNeeded = !mine && !!maybe?.has(ms);
          const taken = !mine && !ifNeeded && !!busy?.has(ms);
          const n = othersFree.get(ms) ?? 0;
          return (
            <button
              type="button"
              key={r.key}
              className={`slot-row${mine ? " on" : ifNeeded ? " maybe" : taken ? " busy" : ""}`}
              aria-pressed={mine ? true : ifNeeded ? "mixed" : false}
              onClick={() => toggle(ms)}
            >
              <span className="slot-check">
                <Icon name="check" size={14} strokeWidth={3} />
              </span>
              <span className="slot-time">
                {fmt(r.key)} – {fmt(r.key + step)}
                {ifNeeded && <span className="slot-tag">{t("If needed")}</span>}
                {taken && <span className="slot-tag slot-tag-busy">{t("Busy on calendar")}</span>}
              </span>
              {othersTotal > 0 && (
                <span className="slot-others">
                  <span className="slot-bar">
                    <span style={{ width: `${(n / othersTotal) * 100}%` }} />
                  </span>
                  <span className={n === othersTotal ? "slot-count all" : "slot-count"}>
                    {n}/{othersTotal}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!isLast && (
        <button type="button" className="btn btn-block" onClick={() => setDay(day + 1)}>
          {t("Next day")} <Icon name="arrowRight" />
        </button>
      )}
    </div>
  );
}
