import { useMemo, useState, type ReactNode } from "react";
import { DateTime } from "luxon";
import Icon from "./Icon";
import { mergeWindows, type TimeWindow, type WindowRange } from "../lib/ranges";
import { recommend, type Recommendation } from "../lib/recommend";
import { sessionAt } from "../lib/finalized";
import { windowComfort } from "../lib/comfort";
import type { Session } from "../lib/overlap";
import type { Participant, PollMeta } from "../lib/types";
import { getLang, joinNames, t } from "../lib/i18n";

interface Props {
  meta: PollMeta;
  participants: Participant[];
  /** Every window of the meeting's length where everyone is free, earliest first. */
  common: TimeWindow[];
  durationMin: number;
  /** "1 hr", "30 min"… */
  durationLabel: string;
  sessionsPerWeek: number;
  picks: number[];
  onPicks: (next: number[]) => void;
  lockedStarts: Set<number>;
  onHover: (sessions: Session[] | null) => void;
  /** The action button under the list. */
  footer: ReactNode;
}

/**
 * "All times everyone can make it". Back-to-back start times are folded into
 * one range ("9:00 AM – 12:00 PM · any 1 hr"); tick a range to offer all of
 * it, or open it to tick single start times. "Smart picks" ticks the few most
 * humane times (see lib/recommend.ts for the rule).
 */
export default function CommonTimes({
  meta,
  participants,
  common,
  durationMin,
  durationLabel,
  sessionsPerWeek,
  picks,
  onPicks,
  lockedStarts,
  onHover,
  footer,
}: Props) {
  const tz = meta.organizerTz;
  const weekly = meta.dateMode === "weekly";
  const stepMs = meta.granularityMin * 60_000;
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  // The meeting length rounded up to whole slots, as the windows were built.
  const windowMs = common[0] ? common[0].endMs - common[0].startMs : durationMin * 60_000;

  // Ranges grouped by day, in the organizer's timezone.
  const days = useMemo(() => {
    const out: { day: string; ranges: WindowRange[] }[] = [];
    for (const r of mergeWindows(common, stepMs)) {
      const day = DateTime.fromMillis(r.startMs, { zone: tz }).toFormat(weekly ? "cccc" : "ccc, LLL d");
      const last = out[out.length - 1];
      if (last && last.day === day) last.ranges.push(r);
      else out.push({ day, ranges: [r] });
    }
    return out;
  }, [common, stepMs, tz, weekly]);
  const rangeCount = days.reduce((n, d) => n + d.ranges.length, 0);

  const shortRange = (w: TimeWindow) => {
    const a = DateTime.fromMillis(w.startMs, { zone: tz });
    const b = DateTime.fromMillis(w.endMs, { zone: tz });
    return `${a.toFormat(a.toFormat("a") === b.toFormat("a") ? "h:mm" : "h:mm a")} – ${b.toFormat("h:mm a")}`;
  };
  const dayLabel = (ms: number) => DateTime.fromMillis(ms, { zone: tz }).toFormat(weekly ? "cccc" : "ccc, LLL d");
  const nightFor = (w: TimeWindow) =>
    participants.filter((p) => windowComfort(w.startMs, w.endMs, p.tz) === "night").map((p) => p.codename);
  const hoverWindow = (w: TimeWindow) =>
    onHover([sessionAt(w.startMs, (w.endMs - w.startMs) / 60_000, meta, participants)]);

  function toggle(start: number) {
    onPicks(picks.includes(start) ? picks.filter((x) => x !== start) : [...picks, start]);
  }
  function toggleRange(r: WindowRange) {
    const all = r.starts.every((s) => picks.includes(s));
    onPicks(all ? picks.filter((x) => !r.starts.includes(x)) : [...new Set([...picks, ...r.starts])]);
  }
  function smartPicks() {
    const next = recommend(common, participants, { stepMs, count: Math.max(3, sessionsPerWeek), dayTz: tz });
    setRecs(next);
    onPicks(next.map((r) => r.startMs));
  }

  function reasonText(r: Recommendation): string {
    return r.reasons
      .map((k) => {
        switch (k) {
          case "daytime":
            return t("Daytime for everyone");
          case "no_night":
            return t("No one up at night");
          case "least_night":
            return t("Fewest people up late");
          case "core":
            return r.core === r.people ? t("Mid-day for everyone") : t("Mid-day for {n} of {total}", { n: r.core, total: r.people });
          case "no_lunch":
            return t("Not over lunch");
          case "weekday":
            return t("On a weekday");
          case "buffer":
            return t("Free time before and after");
        }
      })
      .join(" · ");
  }

  function chip(w: TimeWindow) {
    const on = picks.includes(w.startMs);
    const locked = lockedStarts.has(w.startMs);
    const night = nightFor(w);
    return (
      <button
        type="button"
        key={w.startMs}
        className={`chip time-chip${on ? " on" : ""}${locked ? " locked" : ""}`}
        aria-pressed={on}
        title={night.length ? t("Late night for {names}", { names: joinNames(night) }) : undefined}
        onClick={() => toggle(w.startMs)}
        onMouseEnter={() => hoverWindow(w)}
        onMouseLeave={() => onHover(null)}
      >
        {(on || locked) && <Icon name="check" size={14} />}
        {shortRange(w)}
        {night.length > 0 && (
          <span className="chip-night-mark" aria-label={t("Late night for {names}", { names: joinNames(night) })}>
            <Icon name="moon" size={12} />
            {night.length > 1 ? night.length : ""}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="card common-card">
      <div className="results-head">
        <h2>{t("All times everyone can make it")}</h2>
        <span className="badge badge-ok">{common.length}</span>
        {common.length > 1 && (
          <button type="button" className="btn btn-sm smart-btn" onClick={smartPicks}>
            <Icon name="sparkles" size={14} /> {t("Smart picks")}
          </button>
        )}
      </div>
      <p className="hint">
        {t("Every {d} slot where all {n} people are free, in your timezone. Tick the time to lock it in, or tick several to email them as options for people to choose from.", {
          d: durationLabel,
          n: participants.length,
        })}
        {rangeCount < common.length && `${getLang() === "zh" ? "" : " "}${t("Back-to-back start times are grouped: tick a range to offer any time inside it, or open it to pick one start time.")}`}
      </p>

      {recs && recs.length > 0 && (
        <div className="smart-box">
          <div className="smart-head">
            <span className="smart-title">
              <Icon name="sparkles" size={16} className="icon-brand" /> {t("Smart picks")}
            </span>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                onPicks(picks.filter((p) => !recs.some((r) => r.startMs === p)));
                setRecs(null);
              }}
            >
              {t("Clear")}
            </button>
          </div>
          <ol className="smart-list">
            {recs.map((r) => (
              <li key={r.startMs} onMouseEnter={() => hoverWindow(r)} onMouseLeave={() => onHover(null)}>
                <span className="smart-time">
                  {dayLabel(r.startMs)} · {shortRange(r)}
                </span>
                <span className="smart-why">{reasonText(r)}</span>
              </li>
            ))}
          </ol>
          <details className="smart-rule">
            <summary>{t("How smart picks work")}</summary>
            <p>{t("Each time is checked in every person's own timezone. MeetSpan avoids, in this order:")}</p>
            <ul>
              <li>{t("anyone being up at night (10 PM – 7 AM)")}</li>
              <li>{t("weekends")}</li>
              <li>{t("early mornings and evenings (7–9 AM, 6–10 PM)")}</li>
              <li>{t("lunch (12–1 PM), and times with no slack before or after")}</li>
            </ul>
            <p>{t("It prefers 10 AM – 4 PM, spreads the picks over different days, and breaks ties with the earlier time. The picks are ticked below, so you can lock one in or email them as options.")}</p>
          </details>
        </div>
      )}

      {days.map((g) => (
        <div key={g.day} className="common-day">
          <div className="common-day-label">{g.day}</div>
          <div className="range-list">
            {g.ranges.map((r) => {
              if (r.starts.length === 1) return <div key={r.startMs} className="chips">{chip(r)}</div>;
              const picked = r.starts.filter((s) => picks.includes(s)).length;
              const all = picked === r.starts.length;
              const isOpen = open.has(r.startMs);
              const night = nightFor(r);
              return (
                <div key={r.startMs} className="range">
                  <div className="range-row">
                    <button
                      type="button"
                      className={`chip time-chip range-chip${all ? " on" : picked > 0 ? " partial" : ""}`}
                      aria-pressed={all ? true : picked > 0 ? "mixed" : false}
                      title={night.length ? t("Part of this is late night for {names}", { names: joinNames(night) }) : undefined}
                      onClick={() => toggleRange(r)}
                      onMouseEnter={() => hoverWindow(r)}
                      onMouseLeave={() => onHover(null)}
                    >
                      {all && <Icon name="check" size={14} />}
                      {shortRange(r)}
                      <span className="range-any">{t("any {d}", { d: durationLabel })}</span>
                      {night.length > 0 && (
                        <span className="chip-night-mark" aria-label={t("Part of this is late night for {names}", { names: joinNames(night) })}>
                          <Icon name="moon" size={12} />
                          {night.length > 1 ? night.length : ""}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="link-btn range-toggle"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpen((s) => {
                          const next = new Set(s);
                          if (next.has(r.startMs)) next.delete(r.startMs);
                          else next.add(r.startMs);
                          return next;
                        })
                      }
                    >
                      {picked > 0 && !all
                        ? t("{n} of {total} start times ticked", { n: picked, total: r.starts.length })
                        : t("{n} start times", { n: r.starts.length })}
                      <Icon name="chevronDown" size={14} className={isOpen ? "flip" : ""} />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="chips range-starts">
                      {r.starts.map((s) => chip({ startMs: s, endMs: s + windowMs }))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {footer}
    </div>
  );
}
