import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { recommend } from "./recommend";

const M = 60_000;
const NY = "America/New_York";
const SH = "Asia/Shanghai";

/** 1-hour windows at each half hour from `from` to `to` (start times) on a day in New York. */
function windows(day: string, from: number, to: number, lenMin = 60) {
  const out = [];
  for (let h = from; h <= to; h += 0.5) {
    const start = DateTime.fromISO(day, { zone: NY }).set({ hour: Math.floor(h), minute: (h % 1) * 60 }).toMillis();
    out.push({ startMs: start, endMs: start + lenMin * M });
  }
  return out;
}
const hourIn = (ms: number, tz: string) => DateTime.fromMillis(ms, { zone: tz }).hour;

describe("recommend", () => {
  it("prefers the middle of the day over early or late times", () => {
    // Wed Oct 21 2026, free 7 AM – 9 PM in New York, everyone in New York.
    const recs = recommend(windows("2026-10-21", 7, 20), [{ tz: NY }, { tz: NY }], {
      stepMs: 30 * M,
      count: 1,
      dayTz: NY,
    });
    expect(recs).toHaveLength(1);
    const h = hourIn(recs[0].startMs, NY);
    expect(h).toBeGreaterThanOrEqual(10);
    expect(h).toBeLessThan(16);
    expect(recs[0].reasons).toContain("daytime");
    expect(recs[0].reasons).toContain("core");
  });

  it("avoids night for someone in another timezone", () => {
    // New York 7 AM – 9 PM is 7 PM – 9 AM in Shanghai: evening NY = morning Shanghai.
    const recs = recommend(windows("2026-10-21", 7, 20), [{ tz: NY }, { tz: SH }], {
      stepMs: 30 * M,
      count: 3,
      dayTz: NY,
    });
    for (const r of recs) {
      const sh = DateTime.fromMillis(r.startMs, { zone: SH });
      const shEnd = DateTime.fromMillis(r.endMs, { zone: SH });
      // Never between 10 PM and 7 AM in Shanghai.
      expect(sh.hour >= 7 && (shEnd.hour < 22 || (shEnd.hour === 22 && shEnd.minute === 0))).toBe(true);
    }
    expect(recs[0].reasons).not.toContain("least_night");
  });

  it("spreads picks over different days", () => {
    const all = [...windows("2026-10-21", 9, 15), ...windows("2026-10-22", 9, 15), ...windows("2026-10-23", 9, 15)];
    const recs = recommend(all, [{ tz: NY }], { stepMs: 30 * M, count: 3, dayTz: NY });
    const days = new Set(recs.map((r) => DateTime.fromMillis(r.startMs, { zone: NY }).toISODate()));
    expect(days.size).toBe(3);
  });

  it("fills from the same day without overlapping picks", () => {
    const recs = recommend(windows("2026-10-21", 9, 16), [{ tz: NY }], { stepMs: 30 * M, count: 3, dayTz: NY });
    expect(recs).toHaveLength(3);
    const sorted = [...recs].sort((a, b) => a.startMs - b.startMs);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].startMs).toBeGreaterThanOrEqual(sorted[i - 1].endMs);
  });

  it("prefers a weekday over the weekend", () => {
    // Sat Oct 24 and Mon Oct 26, same hours.
    const all = [...windows("2026-10-24", 10, 12), ...windows("2026-10-26", 10, 12)];
    const [best] = recommend(all, [{ tz: NY }], { stepMs: 30 * M, count: 1, dayTz: NY });
    expect(DateTime.fromMillis(best.startMs, { zone: NY }).weekday).toBe(1);
    expect(best.reasons).toContain("weekday");
  });

  it("returns nothing when no one can make it", () => {
    expect(recommend([], [{ tz: NY }], { stepMs: 30 * M, count: 3, dayTz: NY })).toEqual([]);
  });
});
