import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { buildSlots, buildGridModel, tzInfo, groupTimeZones } from "./slots";

const S30 = 30 * 60_000;

describe("buildSlots", () => {
  it("expands a simple day at the right spacing", () => {
    const slots = buildSlots(
      ["2026-07-06"],
      { startHour: 9, endHour: 11 },
      30,
      "America/New_York"
    );
    expect(slots).toHaveLength(4); // 9:00, 9:30, 10:00, 10:30
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i] - slots[i - 1]).toBe(S30);
    }
    // First slot is 9:00 America/New_York (EDT = UTC-4) on that date.
    const first = DateTime.fromMillis(slots[0], { zone: "America/New_York" });
    expect(first.hour).toBe(9);
    expect(first.minute).toBe(0);
  });

  it("de-dupes and sorts overlapping dates", () => {
    const slots = buildSlots(
      ["2026-07-07", "2026-07-06", "2026-07-06"],
      { startHour: 9, endHour: 10 },
      30,
      "UTC"
    );
    // 2 unique dates × 2 slots each = 4, sorted ascending.
    expect(slots).toHaveLength(4);
    expect([...slots]).toEqual([...slots].sort((a, b) => a - b));
  });

  it("stays monotonic and gap-free across a spring-forward DST day", () => {
    // 2026-03-08: US clocks jump 2:00 -> 3:00. The 2:00 and 2:30 wall times
    // don't exist; the resulting instants must still be unique and 30 min apart.
    const slots = buildSlots(
      ["2026-03-08"],
      { startHour: 1, endHour: 4 },
      30,
      "America/New_York"
    );
    // 1:00, 1:30, 3:00, 3:30 → 4 real instants (2:00/2:30 collapse away).
    expect(slots).toHaveLength(4);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i] - slots[i - 1]).toBe(S30);
    }
    expect(new Set(slots).size).toBe(slots.length);
  });
});

describe("buildGridModel", () => {
  it("groups slots into date columns and time rows", () => {
    const slots = buildSlots(
      ["2026-07-06", "2026-07-07"],
      { startHour: 9, endHour: 11 },
      30,
      "UTC"
    );
    const model = buildGridModel(slots, "UTC");
    expect(model.columns).toHaveLength(2);
    expect(model.rows).toHaveLength(4);
    // Every slot has a cell.
    expect(model.cells.size).toBe(slots.length);
  });

  it("shifts the local grid when viewed from another timezone", () => {
    // A slot at 23:00 UTC lands on the next calendar day in Tokyo (UTC+9).
    const slots = buildSlots(
      ["2026-07-06"],
      { startHour: 23, endHour: 24 },
      60,
      "UTC"
    );
    const tokyo = buildGridModel(slots, "Asia/Tokyo");
    const col = tokyo.columns[0];
    expect(col.key).toBe("2026-07-07"); // rolled to the next day
  });
});

describe("tzInfo aliases", () => {
  const has = (tz: string, q: string) =>
    tzInfo(tz).search.includes(q.toLowerCase());

  it("finds country-collapsed cities that aren't the IANA name", () => {
    // All of mainland China is Asia/Shanghai; India is Asia/Kolkata; etc.
    expect(has("Asia/Shanghai", "beijing")).toBe(true);
    expect(has("Asia/Shanghai", "北京")).toBe(true);
    expect(has("Asia/Kolkata", "mumbai")).toBe(true);
    expect(has("Asia/Kolkata", "delhi")).toBe(true);
    expect(has("Asia/Ho_Chi_Minh", "saigon")).toBe(true);
    expect(has("Asia/Ho_Chi_Minh", "hanoi")).toBe(true);
  });

  it("still matches the canonical IANA city and country names", () => {
    expect(has("Asia/Shanghai", "shanghai")).toBe(true);
    expect(has("Asia/Tokyo", "japan")).toBe(true);
    expect(has("Europe/London", "uk")).toBe(true);
  });

  it("shows a friendlier display label for collapsed zones", () => {
    expect(tzInfo("Asia/Shanghai").city).toContain("Beijing");
    // Zones without an alias keep their derived city.
    expect(tzInfo("Europe/Oslo").city).toBe("Oslo");
  });

  it("keeps every zone grouped under a real region", () => {
    const groups = groupTimeZones(["Asia/Shanghai", "Europe/Oslo", "UTC"]);
    const regions = groups.map((g) => g.region);
    expect(regions).toContain("Asia");
    expect(regions).toContain("Europe");
    expect(regions).toContain("Other"); // UTC has no "/"
  });
});
