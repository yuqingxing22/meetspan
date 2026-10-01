import type { Session } from "./overlap";
import type { Participant, PollMeta } from "./types";

/** Rebuild a Session for a saved start time (e.g. a finalized poll on reload). */
export function sessionAt(
  startMs: number,
  durationMin: number,
  meta: PollMeta,
  participants: Participant[]
): Session {
  const step = meta.granularityMin * 60_000;
  const endMs = startMs + durationMin * 60_000;
  const covered: number[] = [];
  for (let t = startMs; t < endMs; t += step) covered.push(t);
  const freeIds = participants
    .filter((p) => covered.every((ms) => p.selectedSlots.includes(ms)))
    .map((p) => p.id);
  return {
    startMs,
    endMs,
    slotCount: covered.length,
    count: freeIds.length,
    freeIds,
    missing: participants.map((p) => p.id).filter((id) => !freeIds.includes(id)),
    blockId: 0,
  };
}

/** The organizer's locked-in sessions, if the poll has been finalized. */
export function finalizedSessions(meta: PollMeta, participants: Participant[]): Session[] {
  const f = meta.finalized;
  if (!f) return [];
  return [...f.chosenSlots]
    .sort((a, b) => a - b)
    .map((ms) => sessionAt(ms, f.durationMin, meta, participants));
}
