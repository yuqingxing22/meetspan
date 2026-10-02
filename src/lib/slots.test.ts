import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { buildSlots, buildGridModel, tzInfo, groupTimeZones, searchTimeZones } from "./slots";

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
    expect(tzInfo("Europe/Riga").city).toBe("Riga");
  });

  it("keeps every zone grouped under a real region", () => {
    const groups = groupTimeZones(["Asia/Shanghai", "Europe/Oslo", "UTC"]);
    const regions = groups.map((g) => g.region);
    expect(regions).toContain("Asia");
    expect(regions).toContain("Europe");
    expect(regions).toContain("Other"); // UTC has no "/"
  });

  it("files islands under the continent people look under", () => {
    expect(tzInfo("Atlantic/Reykjavik").region).toBe("Europe");
    expect(tzInfo("Atlantic/Faeroe").region).toBe("Europe"); // legacy id
    expect(tzInfo("Pacific/Honolulu").region).toBe("America");
    expect(tzInfo("Indian/Mauritius").region).toBe("Africa");
    expect(tzInfo("Indian/Maldives").region).toBe("Asia");
    expect(tzInfo("Australia/Sydney").region).toBe("Oceania");
    expect(tzInfo("Pacific/Auckland").region).toBe("Oceania");
    expect(tzInfo("Antarctica/Troll").region).toBe("Other");
    const order = groupTimeZones(["UTC", "Pacific/Fiji", "Asia/Tokyo", "Europe/Paris", "America/Lima", "Africa/Cairo"]).map((g) => g.region);
    expect(order).toEqual(["America", "Europe", "Africa", "Asia", "Oceania", "Other"]);
    const other = groupTimeZones(["Antarctica/Palmer", "UTC", "Antarctica/Troll"]).find((g) => g.region === "Other")!;
    expect(other.zones[0].key).toBe("UTC");
  });
});

describe("timezone search", () => {
  // A fixed summer instant, so DST-dependent offsets are stable.
  const ref = DateTime.fromISO("2026-07-15T12:00:00Z");
  // Chrome's list uses some legacy ids (Asia/Calcutta, Asia/Saigon, Europe/Kiev).
  const ZONES = [
    "Asia/Calcutta", "Asia/Saigon", "Asia/Katmandu", "Asia/Rangoon", "Europe/Kiev",
    "America/Indiana/Knox", "Indian/Maldives", "Asia/Shanghai", "America/Chicago",
    "America/New_York", "America/Creston", "Europe/Bucharest", "America/Denver",
    "America/Phoenix", "America/Los_Angeles", "Pacific/Honolulu", "America/Anchorage",
    "Europe/London", "Europe/Paris", "Europe/Istanbul", "Europe/Dublin", "Asia/Tokyo",
    "Asia/Seoul", "Asia/Hong_Kong", "Australia/Sydney", "Australia/Melbourne",
    "Pacific/Port_Moresby", "Pacific/Guadalcanal", "Pacific/Auckland", "Atlantic/Azores",
    "Pacific/Pago_Pago", "UTC", "America/Vancouver", "America/Sao_Paulo",
  ].map((tz) => tzInfo(tz, ref));
  const top = (q: string) => searchTimeZones(ZONES, q)[0]?.key;
  const all = (q: string) => searchTimeZones(ZONES, q).map((z) => z.key);
  const set = (q: string) => all(q).sort();

  it("finds countries listed under legacy ids", () => {
    expect(top("india")).toBe("Asia/Kolkata");
    expect(top("mumbai")).toBe("Asia/Kolkata");
    expect(top("印度")).toBe("Asia/Kolkata");
    expect(top("vietnam")).toBe("Asia/Ho_Chi_Minh");
    expect(top("nepal")).toBe("Asia/Kathmandu");
    expect(top("myanmar")).toBe("Asia/Yangon");
    expect(top("ukraine")).toBe("Europe/Kyiv");
    expect(tzInfo("Asia/Calcutta").city).toContain("India");
  });

  it("knows US states and doesn't send Phoenix to Denver", () => {
    expect(top("hawaii")).toBe("Pacific/Honolulu");
    expect(top("alaska")).toBe("America/Anchorage");
    expect(top("arizona")).toBe("America/Phoenix");
    expect(all("phoenix")).toEqual(["America/Phoenix"]);
  });

  it("matches offsets exactly, not as a prefix", () => {
    expect(set("utc+1")).toEqual(["Europe/Dublin", "Europe/London"]);
    expect(set("gmt-10")).toEqual(["Pacific/Honolulu"]);
    expect(set("utc+5")).toEqual(["Asia/Kathmandu", "Asia/Kolkata", "Indian/Maldives"]);
    expect(set("utc+5:45")).toEqual(["Asia/Kathmandu"]);
    expect(set("utc+10")).toEqual(["Australia/Melbourne", "Australia/Sydney", "Pacific/Port_Moresby"]);
  });

  it("ranks the best match first", () => {
    expect(top("est")).toBe("America/New_York");
    expect(top("ist")).toBe("Asia/Kolkata");
    expect(top("cst")).toBe("America/Chicago");
    expect(all("cst")).toContain("Asia/Shanghai");
    expect(top("pdt")).toBe("America/Los_Angeles");
    expect(top("utc")).toBe("UTC");
    expect(top("la")).toBe("America/Los_Angeles");
    expect(top("cet")).toBe("Europe/Paris");
    expect(top("jst")).toBe("Asia/Tokyo");
    expect(top("hkt")).toBe("Asia/Hong_Kong");
    expect(top("new york")).toBe("America/New_York");
    expect(top("sao paulo")).toBe("America/Sao_Paulo");
  });

  it("knows common Chinese city names", () => {
    expect(top("温哥华")).toBe("America/Vancouver");
    expect(top("西雅图")).toBe("America/Los_Angeles");
    expect(top("波士顿")).toBe("America/New_York");
    expect(top("墨尔本")).toBe("Australia/Melbourne");
    expect(top("北京")).toBe("Asia/Shanghai");
  });
});
