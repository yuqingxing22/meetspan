import { DateTime } from "luxon";
import type { Session } from "./overlap";
import type { Participant, PollMeta } from "./types";

export interface IcsInput {
  meta: PollMeta;
  meetingName: string;
  sessions: Session[];
  participants: Participant[];
  /** True for weekly/recurring polls → each event repeats weekly. */
  recurring: boolean;
}

/** Escape TEXT values per RFC 5545 (backslash, comma, semicolon, newline). */
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** UTC timestamp in iCalendar basic format: 20260707T160000Z. */
function stamp(ms: number): string {
  return DateTime.fromMillis(ms, { zone: "utc" }).toFormat("yyyyLLdd'T'HHmmss'Z'");
}

/** Fold lines to <=75 octets with a leading space on continuations (RFC 5545). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

/**
 * Build a downloadable .ics calendar with one VEVENT per chosen session. Times
 * are absolute (UTC), so every guest's calendar renders them in their own zone.
 * `nowMs` is passed in (not read from the clock) to keep output deterministic.
 */
export function buildICS(input: IcsInput, nowMs: number): string {
  const { meta, meetingName, sessions, participants, recurring } = input;
  const dtstamp = stamp(nowMs);
  const names = participants.map((p) => p.codename).join(", ");
  const title = meetingName || meta.title || "Meeting";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeetSpan//Meeting Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  sessions.forEach((s, i) => {
    const desc = [
      `Proposed with MeetSpan.`,
      names ? `Attendees: ${names}.` : "",
      meta.organizerName ? `Organizer: ${meta.organizerName}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${s.startMs}-${i}@meetspan`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${stamp(s.startMs)}`);
    lines.push(`DTEND:${stamp(s.endMs)}`);
    lines.push(fold(`SUMMARY:${esc(title)}`));
    if (desc) lines.push(fold(`DESCRIPTION:${esc(desc)}`));
    if (recurring) lines.push("RRULE:FREQ=WEEKLY");
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Trigger a browser download of an .ics file. */
export function downloadICS(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
