import { DateTime } from "luxon";
import { windowComfort } from "./comfort";
import { mergeWindows, type TimeWindow } from "./ranges";

/**
 * "Smart picks": out of all the times everyone can make, the few that are
 * most humane for everyone, judged in each person's own timezone.
 *
 * Score (lower is better), added up over every person:
 *   night (10 PM – 7 AM)              +10   nobody should have to join in the middle of the night
 *   outside work hours (7–9, 6–10 PM)  +2
 *   Saturday or Sunday                 +3
 *   over lunch (12–1 PM)               +1
 *   fully inside 10 AM – 4 PM          −1   the easiest hours for most people
 * and once per time:
 *   starts right when the shared free time starts  +0.5
 *   ends right when the shared free time ends      +0.5   (no slack if someone runs late)
 *
 * Then pick the best time on each day, best first, so the picks are spread
 * over different days; if there are fewer days than picks, add the next best
 * times that don't overlap a pick. Ties go to the earlier time.
 */

export type Reason = "daytime" | "no_night" | "least_night" | "core" | "no_lunch" | "weekday" | "buffer";

export interface Recommendation extends TimeWindow {
  score: number;
  reasons: Reason[];
  /** People for whom it's fully within 10 AM – 4 PM, out of `people` with a timezone. */
  core: number;
  people: number;
}

interface Person {
  tz?: string;
}

const CORE_START = 10 * 60;
const CORE_END = 16 * 60;
const LUNCH_START = 12 * 60;
const LUNCH_END = 13 * 60;

function minuteOfDay(ms: number, tz: string): number {
  const dt = DateTime.fromMillis(ms, { zone: tz });
  return dt.hour * 60 + dt.minute;
}

function score(w: TimeWindow, people: Person[], edges: { atStart: boolean; atEnd: boolean }, weekendInPoll: boolean): Recommendation {
  let s = 0;
  let night = 0;
  let edge = 0;
  let core = 0;
  let lunch = 0;
  let weekend = 0;
  const zoned = people.filter((p): p is Required<Person> => !!p.tz);
  for (const p of zoned) {
    const c = windowComfort(w.startMs, w.endMs, p.tz);
    if (c === "night") night++;
    else if (c === "edge") edge++;
    const a = minuteOfDay(w.startMs, p.tz);
    const len = (w.endMs - w.startMs) / 60_000;
    const b = a + len;
    if (a >= CORE_START && b <= CORE_END) core++;
    if (a < LUNCH_END && b > LUNCH_START) lunch++;
    if (DateTime.fromMillis(w.startMs, { zone: p.tz }).weekday >= 6) weekend++;
  }
  s += night * 10 + edge * 2 + weekend * 3 + lunch - core;
  if (edges.atStart) s += 0.5;
  if (edges.atEnd) s += 0.5;

  const reasons: Reason[] = [];
  if (zoned.length > 0) {
    if (night === 0 && edge === 0) reasons.push("daytime");
    else if (night === 0) reasons.push("no_night");
    else reasons.push("least_night");
    if (core > 0) reasons.push("core");
    if (lunch === 0) reasons.push("no_lunch");
    if (weekendInPoll && weekend === 0) reasons.push("weekday");
  }
  if (!edges.atStart && !edges.atEnd) reasons.push("buffer");
  return { ...w, score: s, reasons, core, people: zoned.length };
}

/**
 * The best `count` of `windows` (all times everyone can make, sorted, each of
 * the meeting's length). `stepMs` is the poll's slot size; `dayTz` decides
 * which calendar day a time is on (the organizer's timezone).
 */
export function recommend(
  windows: TimeWindow[],
  people: Person[],
  opts: { stepMs: number; count: number; dayTz: string }
): Recommendation[] {
  if (windows.length === 0) return [];
  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs);
  const ranges = mergeWindows(sorted, opts.stepMs);
  const weekendInPoll = people.some(
    (p) => p.tz && sorted.some((w) => DateTime.fromMillis(w.startMs, { zone: p.tz }).weekday >= 6)
  );
  const scored = ranges.flatMap((r) =>
    r.starts.map((start) => {
      const w = sorted.find((x) => x.startMs === start)!;
      return score(w, people, { atStart: start === r.startMs, atEnd: w.endMs === r.endMs }, weekendInPoll);
    })
  );
  const better = (a: Recommendation, b: Recommendation) => a.score - b.score || a.startMs - b.startMs;
  const dayOf = (ms: number) => DateTime.fromMillis(ms, { zone: opts.dayTz }).toISODate();

  // Best per day first, for variety.
  const bestByDay = new Map<string | null, Recommendation>();
  for (const r of scored) {
    const d = dayOf(r.startMs);
    const cur = bestByDay.get(d);
    if (!cur || better(r, cur) < 0) bestByDay.set(d, r);
  }
  const picks = [...bestByDay.values()].sort(better).slice(0, opts.count);
  // Fewer days than picks: add the next best times that don't overlap a pick.
  for (const r of [...scored].sort(better)) {
    if (picks.length >= opts.count) break;
    if (picks.some((p) => r.startMs < p.endMs && p.startMs < r.endMs)) continue;
    picks.push(r);
  }
  return picks.sort(better);
}
