import { describe, expect, it } from "vitest";
import { mergeSessions, mergeWindows } from "./ranges";

const M = 60_000;
const H = 60 * M;
const w = (startH: number, lenH = 1) => ({ startMs: startH * H, endMs: (startH + lenH) * H });

describe("mergeWindows", () => {
  it("folds back-to-back start times into one range", () => {
    // 1-hour windows starting 9:00, 9:30, 10:00, 10:30, 11:00 → any hour in 9–12.
    const windows = [9, 9.5, 10, 10.5, 11].map((h) => w(h));
    const out = mergeWindows(windows, 30 * M);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startMs: 9 * H, endMs: 12 * H });
    expect(out[0].starts).toHaveLength(5);
  });

  it("keeps a gap as a new range", () => {
    const out = mergeWindows([w(9), w(9.5), w(14)], 30 * M);
    expect(out.map((r) => [r.startMs / H, r.endMs / H])).toEqual([
      [9, 10.5],
      [14, 15],
    ]);
  });

  it("returns nothing for no windows", () => {
    expect(mergeWindows([], 30 * M)).toEqual([]);
  });
});

describe("mergeSessions", () => {
  const s = (startH: number, freeIds = ["a", "b"]) => ({ ...w(startH), freeIds });

  it("merges overlapping and touching sessions with the same people", () => {
    const out = mergeSessions([s(10), s(9), s(9.5), s(11)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startMs: 9 * H, endMs: 12 * H });
    expect(out[0].sessions.map((x) => x.startMs / H)).toEqual([9, 9.5, 10, 11]);
  });

  it("keeps sessions apart when different people are free", () => {
    expect(mergeSessions([s(9), s(9.5, ["a"])])).toHaveLength(2);
  });

  it("keeps separate times separate", () => {
    expect(mergeSessions([s(9), s(14)])).toHaveLength(2);
  });
});
