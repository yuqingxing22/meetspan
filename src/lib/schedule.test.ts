import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { applySchedule, blockKey, blockOf, referenceWeekSlots } from "./schedule";
import { buildSlots } from "./slots";

describe("weekly schedule", () => {
  // Usual availability: Mondays 9:00–10:00 in Los Angeles.
  const schedule = {
    tz: "America/Los_Angeles",
    blocks: [blockKey(1, 540), blockKey(1, 570)],
    updatedAt: 0,
  };

  it("fills a poll made in the same timezone", () => {
    // Mon Oct 12 and Tue Oct 13 2026, 9–11 AM LA time.
    const slots = buildSlots(["2026-10-12", "2026-10-13"], { startHour: 9, endHour: 11 }, 30, "America/Los_Angeles");
    const picked = [...applySchedule(slots, schedule)].map((ms) =>
      DateTime.fromMillis(ms, { zone: "America/Los_Angeles" }).toFormat("ccc HH:mm")
    );
    expect(picked).toEqual(["Mon 09:00", "Mon 09:30"]);
  });

  it("converts for a poll made in another timezone", () => {
    // Poll in London, Mon Oct 12 2026 16:00–19:00 = 8:00–11:00 in LA.
    const slots = buildSlots(["2026-10-12"], { startHour: 16, endHour: 19 }, 30, "Europe/London");
    const picked = [...applySchedule(slots, schedule)].map((ms) =>
      DateTime.fromMillis(ms, { zone: "Europe/London" }).toFormat("HH:mm")
    );
    expect(picked).toEqual(["17:00", "17:30"]);
  });

  it("follows the user's local time across a DST change", () => {
    // Nov 2 2026 is after US DST ends: 9 AM LA is now 17:00 UTC, not 16:00.
    const slots = buildSlots(["2026-11-02"], { startHour: 8, endHour: 11 }, 30, "America/Los_Angeles");
    const picked = [...applySchedule(slots, schedule)];
    expect(picked.map((ms) => blockOf(ms, "America/Los_Angeles"))).toEqual(["1-540", "1-570"]);
  });

  it("builds a 7-day reference week for the editor", () => {
    const week = referenceWeekSlots("Asia/Shanghai", 9, 12);
    expect(week).toHaveLength(7 * 6);
    expect(blockOf(week[0], "Asia/Shanghai")).toBe("1-540");
    expect(blockOf(week[week.length - 1], "Asia/Shanghai")).toBe("7-690");
  });
});
