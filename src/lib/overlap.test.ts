import { describe, expect, it } from "vitest";
import { computeSchedule, type EngineParticipant } from "./overlap";

const G = 30; // granularity minutes
const S = G * 60_000; // one slot in ms

/** Build `n` contiguous slot starts beginning at `base`. */
function day(base: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => base + i * S);
}

function run(
  slots: number[],
  participants: EngineParticipant[],
  durationMin: number,
  sessionsPerWeek = 1
) {
  return computeSchedule({
    slots,
    granularityMin: G,
    participants,
    durationMin,
    sessionsPerWeek,
  });
}

describe("computeSchedule", () => {
  it("finds a full-overlap window when one exists", () => {
    const slots = day(0, 4); // 0,1,2,3 (×S)
    const res = run(
      slots,
      [
        { id: "a", selectedSlots: [0, S, 2 * S] },
        { id: "b", selectedSlots: [S, 2 * S, 3 * S] },
      ],
      60 // k = 2
    );
    expect(res.kind).toBe("ok");
    expect(res.sessions).toHaveLength(1);
    const s = res.sessions[0];
    expect(s.startMs).toBe(S);
    expect(s.endMs).toBe(3 * S);
    expect(s.count).toBe(2);
    expect(s.missing).toHaveLength(0);
  });

  it("suggests shortening when the full duration doesn't fit", () => {
    const slots = day(0, 3);
    const res = run(
      slots,
      [
        { id: "a", selectedSlots: [0, S] },
        { id: "b", selectedSlots: [S, 2 * S] },
      ],
      60 // k = 2, but only slot S overlaps
    );
    expect(res.kind).toBe("none");
    const shorten = res.suggestions.find((x) => x.kind === "shorten");
    expect(shorten).toBeTruthy();
    expect(shorten!.sessions?.[0].startMs).toBe(S);
    expect(shorten!.sessions?.[0].slotCount).toBe(1);
  });

  it("suggests splitting across days when overlap only fits in short blocks", () => {
    const base2 = 50 * S; // far away → separate day/block
    const slots = [...day(0, 3), ...day(base2, 3)];
    const res = run(
      slots,
      [
        { id: "a", selectedSlots: [0, base2] },
        { id: "b", selectedSlots: [0, base2] },
      ],
      60 // k = 2; only single-slot overlaps, but on two different days
    );
    expect(res.kind).toBe("none");
    const split = res.suggestions.find((x) => x.kind === "split");
    expect(split).toBeTruthy();
    expect(split!.sessions).toHaveLength(2);
    // Two different days (blocks).
    expect(new Set(split!.sessions!.map((s) => s.blockId)).size).toBe(2);
  });

  it("suggests excluding one person when that unlocks the full window", () => {
    const slots = day(0, 4);
    const res = run(
      slots,
      [
        { id: "a", selectedSlots: [0, S, 2 * S, 3 * S] },
        { id: "b", selectedSlots: [0, S, 2 * S, 3 * S] },
        { id: "c", selectedSlots: [0] }, // only free in the first slot
      ],
      60 // k = 2
    );
    expect(res.kind).toBe("none");
    const excl = res.suggestions.find((x) => x.kind === "exclude");
    expect(excl).toBeTruthy();
    expect(excl!.excluded).toEqual(["c"]);
    expect(excl!.sessions?.[0].count).toBe(2);
  });

  it("selects multiple sessions on distinct days when requested", () => {
    const base2 = 50 * S;
    const slots = [...day(0, 4), ...day(base2, 4)];
    const everyone = [0, S, 2 * S, 3 * S, base2, base2 + S, base2 + 2 * S, base2 + 3 * S];
    const res = run(
      slots,
      [
        { id: "a", selectedSlots: everyone },
        { id: "b", selectedSlots: everyone },
      ],
      60, // k = 2
      2 // two sessions per week
    );
    expect(res.kind).toBe("ok");
    expect(res.sessions).toHaveLength(2);
    expect(new Set(res.sessions.map((s) => s.blockId)).size).toBe(2);
  });

  it("reports no responses gracefully", () => {
    const res = run(day(0, 4), [], 60);
    expect(res.kind).toBe("none");
    expect(res.total).toBe(0);
    expect(res.suggestions[0].kind).toBe("insufficient");
  });

  it("does not treat non-contiguous slots as one window", () => {
    // Two slots that are adjacent in the array but far apart in time.
    const slots = [0, 100 * S];
    const res = run(
      slots,
      [
        { id: "a", selectedSlots: [0, 100 * S] },
        { id: "b", selectedSlots: [0, 100 * S] },
      ],
      60 // k = 2 — must NOT span the gap
    );
    expect(res.kind).toBe("none");
  });
});
