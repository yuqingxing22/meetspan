// Start and end of weekly (recurring) meetings: which week the schedule starts
// in, when it stops, and the iCalendar RRULE that carries both to calendars.

import { DateTime } from "luxon";
import { getLang, t } from "./i18n";
import type { PollMeta, RepeatEnd } from "./types";

/** Longest "after N weeks" we accept (two years). */
export const MAX_REPEAT_WEEKS = 104;

/** Monday of the week the poll's slots were built in (organizer tz). */
export function dataWeekMonday(meta: Pick<PollMeta, "dates" | "organizerTz">): DateTime {
  const first = [...(meta.dates ?? [])].sort()[0] ?? DateTime.now().toISODate()!;
  return DateTime.fromISO(first, { zone: meta.organizerTz }).startOf("week");
}

/** Monday of the week the meeting actually starts (organizer tz). */
export function firstWeekMonday(meta: Pick<PollMeta, "dates" | "organizerTz" | "firstWeek">): DateTime {
  if (meta.firstWeek) return DateTime.fromISO(meta.firstWeek, { zone: meta.organizerTz }).startOf("week");
  return dataWeekMonday(meta);
}

/**
 * Move a time from the poll's own week to the start week, keeping the
 * organizer's local clock time (so 9 AM stays 9 AM across a DST change).
 */
export function toFirstWeek(meta: Pick<PollMeta, "dates" | "organizerTz" | "firstWeek" | "dateMode">, ms: number): number {
  if (meta.dateMode !== "weekly" || !meta.firstWeek) return ms;
  const weeks = Math.round(firstWeekMonday(meta).diff(dataWeekMonday(meta), "weeks").weeks);
  return weeks ? DateTime.fromMillis(ms, { zone: meta.organizerTz }).plus({ weeks }).toMillis() : ms;
}

/** Shift a session ({startMs, endMs, …}) to the start week. */
export function sessionInFirstWeek<S extends { startMs: number; endMs: number }>(
  meta: Pick<PollMeta, "dates" | "organizerTz" | "firstWeek" | "dateMode">,
  s: S
): S {
  return { ...s, startMs: toFirstWeek(meta, s.startMs), endMs: toFirstWeek(meta, s.endMs) };
}

/** The last instant of `iso` in `tz`, as an iCalendar UTC stamp (20261218T075959Z). */
function untilStamp(iso: string, tz: string): string {
  return DateTime.fromISO(iso, { zone: tz }).endOf("day").toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

/** "RRULE:FREQ=WEEKLY", plus ";COUNT=n" or ";UNTIL=…" when the meeting has an end. */
export function weeklyRRule(meta: Pick<PollMeta, "repeatEnd" | "organizerTz">): string {
  const end = meta.repeatEnd;
  if (end && "count" in end) return `RRULE:FREQ=WEEKLY;COUNT=${end.count}`;
  if (end && "until" in end) return `RRULE:FREQ=WEEKLY;UNTIL=${untilStamp(end.until, meta.organizerTz)}`;
  return "RRULE:FREQ=WEEKLY";
}

/** "for 10 weeks" / "until Fri, Dec 18", or "" with no end. */
export function repeatEndLabel(end: RepeatEnd | undefined): string {
  if (!end) return "";
  if ("count" in end) return t(end.count === 1 ? "for 1 week" : "for {n} weeks", { n: end.count });
  return t("until {date}", { date: DateTime.fromISO(end.until).toFormat("ccc, LLL d, yyyy") });
}

/** What's wrong with an end setting, or "" when it's fine. `firstDate` is the first meeting day. */
export function repeatEndError(end: RepeatEnd | undefined, firstDate: string | undefined): string {
  if (!end) return "";
  if ("count" in end) {
    if (!Number.isInteger(end.count) || end.count < 1 || end.count > MAX_REPEAT_WEEKS)
      return t("Enter a number of weeks from 1 to {max}.", { max: MAX_REPEAT_WEEKS });
    return "";
  }
  if (!end.until) return t("Pick the last day it can happen.");
  if (firstDate && end.until < firstDate) return t("The end date is before the first meeting.");
  return "";
}

/** "from the week of Jan 12, for 10 weeks" (start always, end when set), for page headers. */
export function weeklyRangeLabel(meta: Pick<PollMeta, "dates" | "organizerTz" | "firstWeek" | "repeatEnd">): string {
  const sep = getLang() === "zh" ? "，" : ", ";
  const start = t("from the week of {date}", { date: firstWeekMonday(meta).toFormat("LLL d") });
  const end = repeatEndLabel(meta.repeatEnd);
  return end ? `${start}${sep}${end}` : start;
}
