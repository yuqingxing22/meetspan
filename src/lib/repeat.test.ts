import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { buildICS } from "./ics";
import { generateEmail } from "./email";
import { firstWeekMonday, repeatEndError, toFirstWeek, weeklyRRule } from "./repeat";
import type { PollMeta } from "./types";

const LA = "America/Los_Angeles";
// A weekly poll built in the week of Mon Oct 12 2026 (PDT), Mondays 9 AM.
const meta = (over: Partial<PollMeta> = {}): PollMeta => ({
  title: "Lab sync",
  createdAt: 0,
  status: "open",
  adminTokenHash: "",
  organizerUid: "u",
  organizerName: "",
  organizerTz: LA,
  granularityMin: 30,
  dailyWindow: { startHour: 9, endHour: 12 },
  dateMode: "weekly",
  dates: ["2026-10-12"],
  weekdays: [1],
  slots: [],
  ...over,
});
const nineAm = DateTime.fromISO("2026-10-12T09:00", { zone: LA }).toMillis();
const session = { startMs: nineAm, endMs: nineAm + 3600_000, slotCount: 2, count: 1, freeIds: [], missing: [], blockId: 0 };

describe("weekly repeat", () => {
  it("writes COUNT or an end-of-day UNTIL into the RRULE", () => {
    expect(weeklyRRule(meta())).toBe("RRULE:FREQ=WEEKLY");
    expect(weeklyRRule(meta({ repeatEnd: { count: 10 } }))).toBe("RRULE:FREQ=WEEKLY;COUNT=10");
    // Dec 18 ends at 23:59:59 PST = 07:59:59 UTC the next day.
    expect(weeklyRRule(meta({ repeatEnd: { until: "2026-12-18" } }))).toBe("RRULE:FREQ=WEEKLY;UNTIL=20261219T075959Z");
  });

  it("moves the schedule to a later start week, keeping 9 AM across DST", () => {
    const m = meta({ firstWeek: "2027-01-11" });
    expect(firstWeekMonday(m).toISODate()).toBe("2027-01-11");
    const moved = DateTime.fromMillis(toFirstWeek(m, nineAm), { zone: LA });
    expect(moved.toFormat("yyyy-MM-dd HH:mm ccc")).toBe("2027-01-11 09:00 Mon");
    expect(toFirstWeek(meta(), nineAm)).toBe(nineAm); // no start week set: unchanged
  });

  it("checks the end setting", () => {
    expect(repeatEndError(undefined, "2026-10-12")).toBe("");
    expect(repeatEndError({ count: 0 }, "2026-10-12")).not.toBe("");
    expect(repeatEndError({ count: 200 }, "2026-10-12")).not.toBe("");
    expect(repeatEndError({ until: "" }, "2026-10-12")).not.toBe("");
    expect(repeatEndError({ until: "2026-10-01" }, "2026-10-12")).not.toBe("");
    expect(repeatEndError({ until: "2026-12-18" }, "2026-10-12")).toBe("");
  });

  it("carries the start week and end into the .ics and the email", () => {
    const m = meta({ firstWeek: "2027-01-11", repeatEnd: { count: 10 } });
    const ics = buildICS({ meta: m, meetingName: "Lab sync", sessions: [session], participants: [], recurring: true }, 0);
    expect(ics).toContain("DTSTART:20270111T170000Z"); // 9 AM PST
    expect(ics).toContain("RRULE:FREQ=WEEKLY;COUNT=10");
    const input = { meta: m, meetingName: "Lab sync", durationMin: 60, sessionsPerWeek: 1, type: "team" as const, sessions: [session], participants: [] };
    expect(generateEmail({ ...input, lang: "en" }).body).toContain("Starting the week of Jan 11, for 10 weeks.");
    expect(generateEmail({ ...input, lang: "zh" }).body).toContain("从 1月11日 那周开始，共 10 周。");
  });
});
