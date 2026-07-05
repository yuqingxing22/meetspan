/**
 * Pure scheduling engine. Given the poll's absolute slots and each
 * participant's selected slots, find meeting windows that satisfy the
 * requested duration — and when none exist, explain why and offer concrete
 * alternatives (shorten, split across days, exclude someone, better days).
 *
 * Everything here is timezone-agnostic: slots are absolute epoch-ms and
 * "days" are derived from contiguity (a gap between slots = a day boundary),
 * so no tz is needed and the logic is fully deterministic/testable.
 */

export interface EngineParticipant {
  id: string;
  selectedSlots: number[];
}

export interface ComputeInput {
  slots: number[];
  granularityMin: number;
  participants: EngineParticipant[];
  durationMin: number;
  sessionsPerWeek: number;
}

export interface Session {
  startMs: number;
  endMs: number;
  slotCount: number;
  /** How many participants are free for the WHOLE window. */
  count: number;
  freeIds: string[];
  /** Participant ids not free for the whole window. */
  missing: string[];
  /** Contiguous-block index (proxy for "day"). */
  blockId: number;
}

export type ResultKind = "ok" | "none";

export interface Suggestion {
  kind: "shorten" | "split" | "exclude" | "better_days" | "insufficient";
  title: string;
  detail: string;
  sessions?: Session[];
  excluded?: string[];
}

export interface ComputeResult {
  kind: ResultKind;
  total: number;
  /** Slots required to cover the duration (k = ceil(D / granularity)). */
  requestedSlots: number;
  /** Chosen sessions when a full-overlap schedule was found. */
  sessions: Session[];
  suggestions: Suggestion[];
  /** Per-slot availability, for the heatmap / debugging. */
  stats: { ms: number; count: number; available: string[] }[];
}

const MS_PER_MIN = 60_000;

function intersectInto(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const x of a) if (b.has(x)) out.add(x);
  return out;
}

function overlaps(a: Session, b: Session): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/** Per-slot availability sets, plus a contiguous-block id per slot. */
function buildSlotIndex(input: ComputeInput) {
  const { slots, granularityMin, participants } = input;
  const step = granularityMin * MS_PER_MIN;
  const memberships: Set<string>[] = slots.map(() => new Set<string>());
  const slotPos = new Map<number, number>();
  slots.forEach((ms, i) => slotPos.set(ms, i));
  for (const p of participants) {
    for (const ms of p.selectedSlots) {
      const i = slotPos.get(ms);
      if (i !== undefined) memberships[i].add(p.id);
    }
  }
  const blockId: number[] = new Array(slots.length);
  let block = 0;
  for (let i = 0; i < slots.length; i++) {
    if (i > 0 && slots[i] - slots[i - 1] !== step) block++;
    blockId[i] = block;
  }
  return { step, memberships, blockId };
}

/** All contiguous windows of `k` slots whose whole-window coverage >= minCount. */
function windowsOfSize(
  input: ComputeInput,
  index: ReturnType<typeof buildSlotIndex>,
  allIds: string[],
  k: number,
  minCount: number
): Session[] {
  const { slots } = input;
  const { step, memberships, blockId } = index;
  const out: Session[] = [];
  for (let i = 0; i + k <= slots.length; i++) {
    let contiguous = true;
    for (let j = i; j < i + k - 1; j++) {
      if (slots[j + 1] - slots[j] !== step) {
        contiguous = false;
        break;
      }
    }
    if (!contiguous) continue;

    let free = new Set(memberships[i]);
    for (let j = i + 1; j < i + k && free.size >= minCount; j++) {
      free = intersectInto(free, memberships[j]);
    }
    if (free.size < minCount) continue;

    const freeIds = [...free];
    const missing = allIds.filter((id) => !free.has(id));
    out.push({
      startMs: slots[i],
      endMs: slots[i + k - 1] + step,
      slotCount: k,
      count: free.size,
      freeIds,
      missing,
      blockId: blockId[i],
    });
  }
  return out;
}

/** Pick up to `n` non-overlapping sessions, preferring distinct days & coverage. */
function selectSessions(windows: Session[], n: number): Session[] {
  const ranked = [...windows].sort(
    (a, b) => b.count - a.count || a.startMs - b.startMs
  );
  const chosen: Session[] = [];
  const usedBlocks = new Set<number>();
  // Pass 1: one per day (distinct block), non-overlapping.
  for (const w of ranked) {
    if (chosen.length >= n) break;
    if (usedBlocks.has(w.blockId)) continue;
    if (chosen.some((c) => overlaps(c, w))) continue;
    chosen.push(w);
    usedBlocks.add(w.blockId);
  }
  // Pass 2: fill remaining from any non-overlapping window.
  if (chosen.length < n) {
    for (const w of ranked) {
      if (chosen.length >= n) break;
      if (chosen.includes(w)) continue;
      if (chosen.some((c) => overlaps(c, w))) continue;
      chosen.push(w);
    }
  }
  return chosen.sort((a, b) => a.startMs - b.startMs);
}

/** Largest window size ≤ maxK that still has a full-overlap window. */
function largestFullOverlapSize(
  input: ComputeInput,
  index: ReturnType<typeof buildSlotIndex>,
  allIds: string[],
  total: number,
  maxK: number
): { size: number; windows: Session[] } | null {
  for (let kp = maxK; kp >= 1; kp--) {
    const w = windowsOfSize(input, index, allIds, kp, total);
    if (w.length) return { size: kp, windows: w };
  }
  return null;
}

export function computeSchedule(input: ComputeInput): ComputeResult {
  const { slots, granularityMin, participants, durationMin, sessionsPerWeek } =
    input;
  const total = participants.length;
  const F = Math.max(1, sessionsPerWeek);
  const k = Math.max(1, Math.ceil(durationMin / granularityMin));
  const index = buildSlotIndex(input);
  const allIds = participants.map((p) => p.id);

  const stats = slots.map((ms, i) => ({
    ms,
    count: index.memberships[i].size,
    available: [...index.memberships[i]],
  }));

  const suggestions: Suggestion[] = [];

  if (total === 0) {
    return {
      kind: "none",
      total,
      requestedSlots: k,
      sessions: [],
      suggestions: [
        {
          kind: "insufficient",
          title: "No responses yet",
          detail: "Wait for participants to submit their availability first.",
        },
      ],
      stats,
    };
  }

  // 1) Try full overlap at the requested duration.
  const fullWindows = windowsOfSize(input, index, allIds, k, total);
  if (fullWindows.length) {
    const chosen = selectSessions(fullWindows, F);
    if (chosen.length < F) {
      suggestions.push({
        kind: "better_days",
        title: `Only ${chosen.length} of ${F} sessions fit with everyone free`,
        detail:
          "There aren't enough separate windows where all participants overlap. Consider fewer sessions per week, a shorter duration, or excluding someone (see below).",
      });
      // Also surface fallbacks so the organizer has options.
      appendExcludeAndShorten(input, index, allIds, total, k, F, suggestions);
    }
    return {
      kind: "ok",
      total,
      requestedSlots: k,
      sessions: chosen,
      suggestions,
      stats,
    };
  }

  // 2) No full-overlap window at the requested duration → explain + suggest.

  // (a) Shorten: largest duration where everyone still overlaps.
  const largest = largestFullOverlapSize(input, index, allIds, total, k - 1);
  if (largest) {
    const mins = largest.size * granularityMin;
    suggestions.push({
      kind: "shorten",
      title: `Shorten to ${mins} min — everyone can make it`,
      detail: `No ${durationMin}-min window works for all ${total}, but a ${mins}-min window does.`,
      sessions: selectSessions(largest.windows, F),
    });

    // (b) Split: cover the full duration across several shorter days. Only
    // offer it if the chosen shorter sessions actually add up to the duration.
    const parts = Math.ceil(k / largest.size);
    if (parts >= 2) {
      const split = selectSessions(largest.windows, parts);
      const coveredSlots = split.reduce((a, s) => a + s.slotCount, 0);
      if (split.length >= 2 && coveredSlots >= k) {
        suggestions.push({
          kind: "split",
          title: `Split into ${split.length} shorter sessions across days`,
          detail: `Instead of one ${durationMin}-min meeting, run ${split.length} sessions of ${mins} min on different days — everyone is free for each.`,
          sessions: split,
        });
      }
    }
  }

  // (c) Exclude: full-length window if one person steps out.
  appendExclude(input, index, allIds, total, k, F, suggestions);

  // (d) Better days: where is overlap strongest for this duration?
  const anyWindows = windowsOfSize(input, index, allIds, k, 1);
  if (anyWindows.length) {
    const bestPerBlock = new Map<number, Session>();
    for (const w of anyWindows) {
      const cur = bestPerBlock.get(w.blockId);
      if (!cur || w.count > cur.count) bestPerBlock.set(w.blockId, w);
    }
    const top = [...bestPerBlock.values()]
      .sort((a, b) => b.count - a.count || a.startMs - b.startMs)
      .slice(0, 3);
    suggestions.push({
      kind: "better_days",
      title: "Best partial overlaps",
      detail: `The strongest ${durationMin}-min windows cover ${top
        .map((s) => `${s.count}/${total}`)
        .join(", ")} participants.`,
      sessions: top,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      kind: "insufficient",
      title: "Not enough shared availability",
      detail:
        "No window fits even a shortened meeting. Ask participants to add more available slots, or widen the candidate dates/hours.",
    });
  }

  return { kind: "none", total, requestedSlots: k, sessions: [], suggestions, stats };
}

/** Push an "exclude one person" suggestion if a full-length window opens up. */
function appendExclude(
  input: ComputeInput,
  index: ReturnType<typeof buildSlotIndex>,
  allIds: string[],
  total: number,
  k: number,
  F: number,
  suggestions: Suggestion[]
): void {
  if (total < 2) return;
  const near = windowsOfSize(input, index, allIds, k, total - 1).filter(
    (w) => w.count === total - 1
  );
  if (!near.length) return;
  // Prefer excluding the same single person across the chosen sessions.
  const byExcluded = new Map<string, Session[]>();
  for (const w of near) {
    if (w.missing.length !== 1) continue;
    const id = w.missing[0];
    if (!byExcluded.has(id)) byExcluded.set(id, []);
    byExcluded.get(id)!.push(w);
  }
  let best: { id: string; sessions: Session[] } | null = null;
  for (const [id, ws] of byExcluded) {
    const picked = selectSessions(ws, F);
    if (!best || picked.length > best.sessions.length) best = { id, sessions: picked };
  }
  if (best && best.sessions.length) {
    suggestions.push({
      kind: "exclude",
      title: "Works if one person steps out",
      detail: `Excluding one participant opens up the full-length window.`,
      sessions: best.sessions,
      excluded: [best.id],
    });
  }
}

/** Convenience used when full overlap exists but not enough sessions. */
function appendExcludeAndShorten(
  input: ComputeInput,
  index: ReturnType<typeof buildSlotIndex>,
  allIds: string[],
  total: number,
  k: number,
  F: number,
  suggestions: Suggestion[]
): void {
  appendExclude(input, index, allIds, total, k, F, suggestions);
}
