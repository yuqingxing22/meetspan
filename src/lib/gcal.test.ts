import { describe, expect, it } from "vitest";
import { freeSlots, shiftWeeks, weeksAhead } from "./gcal";

const tz = "America/Los_Angeles";
const h = 3600_000;
const nine = Date.parse("2026-10-14T16:00:00Z"); // Wed 9:00 AM PDT

describe("calendar import helpers", () => {
  it("marks slots that don't overlap a busy block", () => {
    const slots = [nine, nine + h / 2, nine + h, nine + 1.5 * h];
    const busy = [{ start: nine + h / 2 + 10 * 60_000, end: nine + h + 5 * 60_000 }];
    expect([...freeSlots(slots, 30, busy, 0, tz)]).toEqual([nine, nine + 1.5 * h]);
  });

  it("a busy block ending exactly at a slot start doesn't block it", () => {
    expect(freeSlots([nine], 30, [{ start: nine - h, end: nine }], 0, tz).has(nine)).toBe(true);
  });

  it("moves a past weekly reference week to the upcoming copy", () => {
    expect(weeksAhead([nine], false, nine + 30 * 86_400_000)).toBe(0);
    expect(weeksAhead([nine], true, nine - h)).toBe(0);
    expect(weeksAhead([nine], true, nine + 10 * 86_400_000)).toBe(2);
  });

  it("keeps the local clock time across a DST change", () => {
    // Oct 14 → Nov 4: LA leaves daylight time on Nov 1, so 9:00 PDT → 9:00 PST.
    const moved = shiftWeeks(nine, 3, tz);
    expect(moved - nine).toBe(21 * 86_400_000 + h);
  });
});
