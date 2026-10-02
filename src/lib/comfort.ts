import { DateTime } from "luxon";
import { t } from "./i18n";

/**
 * How reasonable a meeting time is for someone, judged in *their* timezone.
 * This is MeetSpan's cross-timezone nudge: a slot everyone marked "free" can
 * still be 12:30 AM for one person.
 *
 *   day   — 09:00–18:00
 *   edge  — 07:00–09:00 or 18:00–22:00 (outside work hours, but awake)
 *   night — 22:00–07:00
 */
export type Comfort = "day" | "edge" | "night";

const RANK: Record<Comfort, number> = { day: 0, edge: 1, night: 2 };

export function hourComfort(minuteOfDay: number): Comfort {
  if (minuteOfDay < 7 * 60 || minuteOfDay >= 22 * 60) return "night";
  if (minuteOfDay < 9 * 60 || minuteOfDay >= 18 * 60) return "edge";
  return "day";
}

/** The worst comfort across a window [startMs, endMs) in `tz`, checked every 30 min. */
export function windowComfort(startMs: number, endMs: number, tz: string): Comfort {
  let worst: Comfort = "day";
  for (let t = startMs; t < endMs; t += 30 * 60_000) {
    const dt = DateTime.fromMillis(t, { zone: tz });
    const c = hourComfort(dt.hour * 60 + dt.minute);
    if (RANK[c] > RANK[worst]) worst = c;
  }
  return worst;
}

/** Short words for a non-daytime start, e.g. "late night", "early morning", "evening". */
export function comfortLabel(startMs: number, tz: string, comfort: Comfort): string {
  if (comfort === "day") return "";
  const h = DateTime.fromMillis(startMs, { zone: tz }).hour;
  if (comfort === "night") return h >= 5 && h < 7 ? t("very early") : t("late night");
  return h < 12 ? t("early morning") : t("evening");
}

/**
 * Penalty for ranking otherwise-equal times: each person at night costs 3,
 * each person outside work hours costs 1. People without a timezone are skipped.
 */
export function windowPenalty(
  startMs: number,
  endMs: number,
  tzs: (string | undefined)[]
): number {
  let p = 0;
  for (const tz of tzs) {
    if (!tz) continue;
    const c = windowComfort(startMs, endMs, tz);
    p += c === "night" ? 3 : c === "edge" ? 1 : 0;
  }
  return p;
}
