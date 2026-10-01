import { describe, expect, it } from "vitest";
import { comfortLabel, windowComfort, windowPenalty } from "./comfort";

// Wed Oct 14 2026, 9:00–10:00 AM in Los Angeles (16:00–17:00 UTC).
const start = Date.UTC(2026, 9, 14, 16, 0);
const end = Date.UTC(2026, 9, 14, 17, 0);

describe("comfort", () => {
  it("rates the same window per person, in their own timezone", () => {
    expect(windowComfort(start, end, "America/Los_Angeles")).toBe("day");
    expect(windowComfort(start, end, "Europe/London")).toBe("day"); // 5–6 PM, ends at 18:00
    expect(windowComfort(start, end, "Europe/Berlin")).toBe("edge"); // 6–7 PM
    expect(windowComfort(start, end, "Asia/Shanghai")).toBe("night"); // 12–1 AM
  });

  it("labels the start time", () => {
    expect(comfortLabel(start, "Asia/Shanghai", "night")).toBe("late night");
    expect(comfortLabel(start, "Europe/Berlin", "edge")).toBe("evening");
    expect(comfortLabel(start, "America/Los_Angeles", "day")).toBe("");
  });

  it("penalizes nights more than evenings", () => {
    const lateForMei = windowPenalty(start, end, ["America/Los_Angeles", "Asia/Shanghai"]);
    const eveningForAlex = windowPenalty(start, end, ["America/Los_Angeles", "Europe/Berlin"]);
    expect(lateForMei).toBe(3);
    expect(eveningForAlex).toBe(1);
  });
});
