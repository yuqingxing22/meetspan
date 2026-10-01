import { DateTime } from "luxon";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * A signed-in user's usual weekly availability ("My schedule"), so they can
 * fill any poll in one click instead of painting it from scratch.
 *
 * Stored at schedules/{uid}, readable and writable only by that uid. Times are
 * kept as weekday + minute-of-day in the user's own timezone, so a schedule
 * means "9–12 on Mondays where I live" and converts correctly for polls in
 * any other timezone, across DST changes.
 */
export interface WeeklySchedule {
  /** IANA timezone the times are in. */
  tz: string;
  /** "weekday-minute" keys: Luxon weekday 1–7 (Mon–Sun), minute from midnight. */
  blocks: string[];
  updatedAt: number;
}

export function blockKey(weekday: number, minuteOfDay: number): string {
  return `${weekday}-${minuteOfDay}`;
}

/** The schedule block a poll slot falls in, read in the schedule's timezone. */
export function blockOf(ms: number, tz: string): string {
  const dt = DateTime.fromMillis(ms, { zone: tz });
  return blockKey(dt.weekday, dt.hour * 60 + dt.minute);
}

/** Poll slots (epoch-ms) covered by the schedule. */
export function applySchedule(slots: number[], schedule: WeeklySchedule): Set<number> {
  const blocks = new Set(schedule.blocks);
  return new Set(slots.filter((ms) => blocks.has(blockOf(ms, schedule.tz))));
}

// The editor paints a single reference week. Mid-June has no DST switch in
// either hemisphere, so every block maps to exactly one instant.
const REFERENCE_MONDAY = "2025-06-16";

/** Slot instants for the editor's reference week, `startHour`–`endHour` daily. */
export function referenceWeekSlots(tz: string, startHour: number, endHour: number): number[] {
  const monday = DateTime.fromISO(REFERENCE_MONDAY, { zone: tz });
  const out: number[] = [];
  for (let d = 0; d < 7; d++) {
    for (let m = startHour * 60; m < endHour * 60; m += 30) {
      out.push(monday.plus({ days: d }).set({ hour: Math.floor(m / 60), minute: m % 60 }).toMillis());
    }
  }
  return out;
}

export async function loadSchedule(uid: string): Promise<WeeklySchedule | null> {
  const snap = await getDoc(doc(db(), "schedules", uid));
  return snap.exists() ? (snap.data() as WeeklySchedule) : null;
}

export async function saveSchedule(uid: string, schedule: WeeklySchedule): Promise<void> {
  await setDoc(doc(db(), "schedules", uid), schedule);
}
