import { describe, expect, it } from "vitest";
import { bestWindow, commonWindows } from "./best";

const M = 60_000;
const t0 = Date.UTC(2026, 9, 12, 16, 0);
// Day 1: four 30-min slots; day 2: two slots, starting a day later.
const day1 = [0, 1, 2, 3].map((i) => t0 + i * 30 * M);
const day2 = [0, 1].map((i) => t0 + 24 * 60 * M + i * 30 * M);
const slots = [...day1, ...day2];

describe("bestWindow", () => {
  it("returns the window with the most people free", () => {
    const people = [
      { id: "a", slots: new Set([day1[2], day1[3]]) },
      { id: "b", slots: new Set([day1[2], day1[3], day2[0]]) },
      { id: "c", slots: new Set([day1[0], day1[1]]) },
    ];
    const w = bestWindow(slots, 30, people, 2);
    expect(w?.startMs).toBe(day1[2]);
    expect(w?.endMs).toBe(day1[3] + 30 * M);
    expect(w?.freeIds).toEqual(["a", "b"]);
  });

  it("never spans a gap between days", () => {
    // Free across the last slot of day 1 and the first of day 2 only.
    const people = [{ id: "a", slots: new Set([day1[3], day2[0]]) }];
    expect(bestWindow(slots, 30, people, 2)).toBeNull();
  });

  it("keeps the earliest window on a tie", () => {
    const people = [{ id: "a", slots: new Set(slots) }];
    expect(bestWindow(slots, 30, people, 2)?.startMs).toBe(day1[0]);
  });

  it("returns null when nobody has responded", () => {
    expect(bestWindow(slots, 30, [], 2)).toBeNull();
  });
});

describe("commonWindows", () => {
  it("lists every window where everyone is free, earliest first", () => {
    const people = [
      { id: "a", slots: new Set([day1[0], day1[1], day1[2], day2[0], day2[1]]) },
      { id: "b", slots: new Set([day1[0], day1[1], day1[2], day1[3], day2[0], day2[1]]) },
    ];
    const starts = commonWindows(slots, 30, people, 2).map((w) => w.startMs);
    expect(starts).toEqual([day1[0], day1[1], day2[0]]);
  });

  it("is empty when nobody overlaps or nobody responded", () => {
    const people = [
      { id: "a", slots: new Set([day1[0], day1[1]]) },
      { id: "b", slots: new Set([day1[2], day1[3]]) },
    ];
    expect(commonWindows(slots, 30, people, 2)).toEqual([]);
    expect(commonWindows(slots, 30, [], 2)).toEqual([]);
  });
});
