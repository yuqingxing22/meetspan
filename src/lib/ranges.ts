/**
 * Long free stretches produce many overlapping start times (a 3-hour block
 * gives 9:00, 9:30, 10:00 … for a 1-hour meeting). These helpers fold them
 * into one range, "any 1 hr between 9:00 and 12:00", so the list and the
 * options email stay short.
 */

export interface TimeWindow {
  startMs: number;
  endMs: number;
}

export interface WindowRange extends TimeWindow {
  /** Every start time inside the range, earliest first. */
  starts: number[];
}

/** Merge windows whose start times are one slot (`stepMs`) apart. Input must be sorted. */
export function mergeWindows(windows: TimeWindow[], stepMs: number): WindowRange[] {
  const out: WindowRange[] = [];
  for (const w of windows) {
    const last = out[out.length - 1];
    if (last && w.startMs === last.starts[last.starts.length - 1] + stepMs) {
      last.starts.push(w.startMs);
      last.endMs = Math.max(last.endMs, w.endMs);
    } else {
      out.push({ startMs: w.startMs, endMs: w.endMs, starts: [w.startMs] });
    }
  }
  return out;
}

/**
 * Group sessions that overlap or touch and are free for the same people into
 * one block: anyone free for each of them is free for the whole block, so any
 * `duration` inside it works. Order is kept by start time.
 */
export function mergeSessions<T extends TimeWindow & { freeIds: string[] }>(
  sessions: T[]
): { startMs: number; endMs: number; sessions: T[] }[] {
  const sorted = [...sessions].sort((a, b) => a.startMs - b.startMs);
  const key = (s: T) => [...s.freeIds].sort().join("\u0000");
  const out: { startMs: number; endMs: number; sessions: T[] }[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.startMs <= last.endMs && key(s) === key(last.sessions[0])) {
      last.sessions.push(s);
      last.endMs = Math.max(last.endMs, s.endMs);
    } else {
      out.push({ startMs: s.startMs, endMs: s.endMs, sessions: [s] });
    }
  }
  return out;
}
