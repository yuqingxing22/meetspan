/**
 * Quick "best window so far" lookup for live UI hints (the participant
 * sidebar). The full scheduling engine lives in overlap.ts; this only answers
 * "which run of `k` consecutive slots has the most people free right now?".
 */

export interface BestWindow {
  startMs: number;
  endMs: number;
  /** People free for the whole window. */
  freeIds: string[];
}

export function bestWindow(
  slots: number[],
  granularityMin: number,
  people: { id: string; slots: Set<number> }[],
  k: number
): BestWindow | null {
  const step = granularityMin * 60_000;
  const sorted = [...slots].sort((a, b) => a - b);
  let best: BestWindow | null = null;
  for (let i = 0; i + k <= sorted.length; i++) {
    // The window must be contiguous: no day boundary or gap inside it.
    if (sorted[i + k - 1] - sorted[i] !== (k - 1) * step) continue;
    const window = sorted.slice(i, i + k);
    const freeIds = people
      .filter((p) => window.every((ms) => p.slots.has(ms)))
      .map((p) => p.id);
    // Strictly greater keeps the earliest window on ties.
    if (freeIds.length > 0 && (!best || freeIds.length > best.freeIds.length)) {
      best = { startMs: sorted[i], endMs: sorted[i] + k * step, freeIds };
    }
  }
  return best;
}

/**
 * Every window of `k` consecutive slots where *all* people are free — the full
 * list of times everyone can make, earliest first. Overlapping windows are all
 * returned (a 2-hour free block yields 9:00, 9:30, 10:00 … for a 1-hour meeting).
 */
export function commonWindows(
  slots: number[],
  granularityMin: number,
  people: { id: string; slots: Set<number> }[],
  k: number
): { startMs: number; endMs: number }[] {
  if (people.length === 0) return [];
  const step = granularityMin * 60_000;
  const sorted = [...slots].sort((a, b) => a - b);
  const out: { startMs: number; endMs: number }[] = [];
  for (let i = 0; i + k <= sorted.length; i++) {
    if (sorted[i + k - 1] - sorted[i] !== (k - 1) * step) continue;
    const window = sorted.slice(i, i + k);
    if (people.every((p) => window.every((ms) => p.slots.has(ms)))) {
      out.push({ startMs: sorted[i], endMs: sorted[i] + k * step });
    }
  }
  return out;
}
