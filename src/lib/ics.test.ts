import { describe, expect, it } from "vitest";
import { buildICS } from "./ics";
import type { Session } from "./overlap";
import type { Participant, PollMeta } from "./types";

const START = Date.UTC(2026, 6, 6, 16, 0); // 2026-07-06 16:00 UTC
const END = START + 60 * 60_000; // 17:00 UTC
const NOW = Date.UTC(2026, 6, 4, 12, 0);

const session: Session = {
  startMs: START,
  endMs: END,
  slotCount: 2,
  count: 2,
  freeIds: ["a", "b"],
  missing: [],
  blockId: 0,
};

const participants: Participant[] = [
  { id: "a", codename: "Ada", tz: "UTC", ownerUid: "ua", selectedSlots: [], updatedAt: 1 },
  { id: "b", codename: "Ben", tz: "UTC", ownerUid: "ub", selectedSlots: [], updatedAt: 2 },
];

function baseMeta(over: Partial<PollMeta> = {}): PollMeta {
  return {
    title: "Sync",
    createdAt: 0,
    status: "open",
    adminTokenHash: "",
    organizerUid: "org-uid",
    organizerName: "Kyra",
    organizerTz: "UTC",
    granularityMin: 30,
    dailyWindow: { startHour: 9, endHour: 17 },
    dateMode: "specific",
    dates: [],
    weekdays: [],
    slots: [],
    ...over,
  };
}

describe("buildICS", () => {
  it("emits a valid single event in UTC with CRLF lines", () => {
    const ics = buildICS(
      { meta: baseMeta(), meetingName: "Research sync", sessions: [session], participants, recurring: false },
      NOW
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20260706T160000Z");
    expect(ics).toContain("DTEND:20260706T170000Z");
    expect(ics).toContain("SUMMARY:Research sync");
    expect(ics).toContain("\r\n"); // CRLF per RFC 5545
    expect(ics).not.toContain("RRULE"); // one-off event
  });

  it("adds a weekly RRULE for recurring polls", () => {
    const ics = buildICS(
      { meta: baseMeta({ dateMode: "weekly" }), meetingName: "Standup", sessions: [session], participants, recurring: true },
      NOW
    );
    expect(ics).toContain("RRULE:FREQ=WEEKLY");
  });

  it("emits one VEVENT per session", () => {
    const s2: Session = { ...session, startMs: START + 86400_000, endMs: END + 86400_000 };
    const ics = buildICS(
      { meta: baseMeta(), meetingName: "Sync", sessions: [session, s2], participants, recurring: false },
      NOW
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("escapes commas/semicolons in text values", () => {
    const ics = buildICS(
      { meta: baseMeta(), meetingName: "Sync, planning; review", sessions: [session], participants, recurring: false },
      NOW
    );
    expect(ics).toContain("SUMMARY:Sync\\, planning\\; review");
  });
});
