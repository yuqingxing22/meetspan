import { useMemo } from "react";
import AvailabilityGrid from "./AvailabilityGrid";
import Heatmap, { type SlotStat } from "./Heatmap";
import type { Participant } from "../lib/types";

interface Props {
  slots: number[];
  tz: string;
  weekdayOnly?: boolean;
  /** The current viewer's own selection (editable). */
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
  /** Show the editable "Your availability" pane. */
  editable: boolean;
  /** Everyone who has responded (from Firestore). */
  participants: Participant[];
  /** The viewer's participant id ("" if they haven't saved yet). */
  myId: string;
  /** Resolve a participant id to a display name. */
  nameOf: (id: string) => string;
  /** Slot starts to outline as the chosen/best window. */
  highlight?: Set<number>;
}

// Sentinel id for the viewer's own live (possibly unsaved) selection.
const ME = "__me__";

/**
 * When2Meet-style board: paint your own availability on the left while a live
 * group heatmap on the right shows everyone's overlap (darker = more people
 * free). The heatmap folds in the viewer's in-progress edits immediately, so
 * the overlap updates as they paint.
 */
export default function AvailabilityBoard({
  slots,
  tz,
  weekdayOnly,
  selected,
  onChange,
  editable,
  participants,
  myId,
  nameOf,
  highlight,
}: Props) {
  const { statsByMs, total } = useMemo(() => {
    // Everyone except the viewer's stored copy — the viewer is represented by
    // their live `selected` set instead, so unsaved edits show up right away.
    const others = participants.filter((p) => p.id !== myId);
    const meResponded =
      selected.size > 0 || participants.some((p) => p.id === myId);

    const stats = new Map<number, SlotStat>();
    for (const ms of slots) stats.set(ms, { count: 0, available: [] });
    for (const p of others)
      for (const ms of p.selectedSlots) {
        const s = stats.get(ms);
        if (s) {
          s.available.push(p.id);
          s.count++;
        }
      }
    if (meResponded)
      for (const ms of selected) {
        const s = stats.get(ms);
        if (s) {
          s.available.push(ME);
          s.count++;
        }
      }
    return {
      statsByMs: stats,
      total: others.length + (meResponded ? 1 : 0),
    };
  }, [participants, myId, selected, slots]);

  const nameOfWithMe = (id: string) =>
    id === ME || id === myId ? "You" : nameOf(id);

  return (
    <div className="board">
      {editable && (
        <div className="board-col">
          <div className="board-head">
            <span className="board-title">Your availability</span>
            <span className="hint">Click or drag to paint when you're free</span>
          </div>
          <AvailabilityGrid
            slots={slots}
            tz={tz}
            weekdayOnly={weekdayOnly}
            selected={selected}
            onChange={onChange}
          />
        </div>
      )}
      <div className="board-col">
        <div className="board-head">
          <span className="board-title">Group's availability</span>
          <span className="hint">
            Darker = more people free
            {total > 0 ? ` · ${total} in so far` : ""}. Hover to see who.
          </span>
        </div>
        <Heatmap
          slots={slots}
          tz={tz}
          weekdayOnly={weekdayOnly}
          total={total}
          statsByMs={statsByMs}
          nameOf={nameOfWithMe}
          highlight={highlight}
        />
      </div>
    </div>
  );
}
