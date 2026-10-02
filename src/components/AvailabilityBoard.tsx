import { useMemo, useState } from "react";
import AvailabilityGrid from "./AvailabilityGrid";
import DayList from "./DayList";
import Heatmap, { heatLevel, type SlotStat } from "./Heatmap";
import { formatSlot } from "../lib/slots";
import type { Participant } from "../lib/types";
import { t } from "../lib/i18n";

interface Props {
  slots: number[];
  tz: string;
  weekdayOnly?: boolean;
  /** The current viewer's own selection (editable). */
  selected: Set<number>;
  /** New "free" set, plus the new "if needed" set when `maybe` is used. */
  onChange: (next: Set<number>, nextMaybe?: Set<number>) => void;
  /** The viewer's "if needed" slots. Omit to offer only free/busy. */
  maybe?: Set<number>;
  /** Whether the viewer can mark their own times. */
  editable: boolean;
  /** Everyone who has responded (from Firestore). */
  participants: Participant[];
  /** The viewer's participant id ("" if they haven't saved yet). */
  myId: string;
  /** Resolve a participant id to a display name. */
  nameOf: (id: string) => string;
  /** Slot starts to outline as the chosen/best window. */
  highlight?: Set<number>;
  /** Which view opens first (defaults to marking when editable). */
  defaultMode?: "paint" | "group";
  /** Only the "mark my times" view, without the switch to the group view. */
  paintOnly?: boolean;
  /** Report the slot being inspected in the group view (for a side panel). */
  onFocusSlot?: (ms: number | null) => void;
  focusMs?: number | null;
}

// Sentinel id for the viewer's own live (possibly unsaved) selection.
export const ME = "__me__";

/**
 * One grid, two views: paint your own free times (with faint blue showing when
 * others are free), or see everyone's overlap as a heatmap (darker = more
 * people free). The heatmap folds in the viewer's in-progress edits
 * immediately, so the overlap updates as they paint.
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
  defaultMode,
  paintOnly,
  onFocusSlot,
  focusMs,
  maybe,
}: Props) {
  const [mode, setMode] = useState<"paint" | "group">(
    editable ? defaultMode ?? "paint" : "group"
  );
  const [ownFocus, setOwnFocus] = useState<number | null>(null);
  const [brush, setBrush] = useState<"yes" | "maybe">("yes");
  const view = editable ? (paintOnly ? "paint" : mode) : "group";

  const { statsByMs, total, othersFree, othersTotal } = useMemo(() => {
    // Everyone except the viewer's stored copy — the viewer is represented by
    // their live `selected` set instead, so unsaved edits show up right away.
    const others = participants.filter((p) => p.id !== myId);
    const meResponded =
      selected.size > 0 || (maybe?.size ?? 0) > 0 || participants.some((p) => p.id === myId);

    const stats = new Map<number, SlotStat>();
    const free = new Map<number, number>();
    for (const ms of slots) {
      stats.set(ms, { count: 0, available: [], maybe: [] });
      free.set(ms, 0);
    }
    for (const p of others) {
      for (const ms of p.selectedSlots) {
        const s = stats.get(ms);
        if (s) {
          s.available.push(p.id);
          s.count++;
          free.set(ms, (free.get(ms) ?? 0) + 1);
        }
      }
      for (const ms of p.maybeSlots ?? []) stats.get(ms)?.maybe!.push(p.id);
    }
    if (meResponded) {
      for (const ms of selected) {
        const s = stats.get(ms);
        if (s) {
          s.available.push(ME);
          s.count++;
        }
      }
      for (const ms of maybe ?? []) stats.get(ms)?.maybe!.push(ME);
    }
    return {
      statsByMs: stats,
      total: others.length + (meResponded ? 1 : 0),
      othersFree: free,
      othersTotal: others.length,
    };
  }, [participants, myId, selected, maybe, slots]);

  const ghost = useMemo(() => {
    const m = new Map<number, number>();
    for (const [ms, n] of othersFree) m.set(ms, heatLevel(n, othersTotal));
    return m;
  }, [othersFree, othersTotal]);

  const nameOfWithMe = (id: string) => (id === ME || id === myId ? t("You") : nameOf(id));

  // Inspect state: lifted to the parent when it shows its own side panel.
  const focus = onFocusSlot ? focusMs ?? null : ownFocus;
  const setFocus = onFocusSlot ?? setOwnFocus;
  const focusStat = focus !== null ? statsByMs.get(focus) : undefined;

  const hint =
    view === "paint"
      ? othersTotal > 0
        ? t("Click or drag across the grid to mark when you're free. Faint blue shows when others are free.")
        : t("Click or drag across the grid to mark when you're free.")
      : total > 0
      ? t(
          total === 1
            ? "Darker means more people are free. 1 person so far. Hover or tap a slot to see who."
            : "Darker means more people are free. {n} people so far. Hover or tap a slot to see who.",
          { n: total }
        )
      : t("No responses yet. The overlap fills in as people mark their times.");

  return (
    <div className="board">
      <div className="board-toolbar">
        {editable && !paintOnly ? (
          <div className="seg" role="group" aria-label={t("View")}>
            <button
              type="button"
              className={view === "paint" ? "active" : ""}
              aria-pressed={view === "paint"}
              onClick={() => setMode("paint")}
            >
              {t("Mark my times")}
            </button>
            <button
              type="button"
              className={view === "group" ? "active" : ""}
              aria-pressed={view === "group"}
              onClick={() => setMode("group")}
            >
              {t("See everyone")}
            </button>
          </div>
        ) : paintOnly ? (
          // Paint-only: the hint sits where the view switch would be.
          <p className="board-hint board-hint-inline only-wide">{hint}</p>
        ) : (
          <span />
        )}
        {view === "paint" ? (
          <div className="legend">
            <span className="swatch swatch-me" />
            {t("You're free")}
            {maybe && (
              <>
                <span className="swatch swatch-maybe" />
                {t("If needed")}
              </>
            )}
            {othersTotal > 0 && (
              <>
                <span className="swatch swatch-ghost" />
                {t("Others free (faint)")}
              </>
            )}
          </div>
        ) : (
          <div className="legend">
            0
            <span className="ramp" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((l) => (
                <span key={l} className={`h${l}`} />
              ))}
            </span>
            {t("{n} free", { n: total })}
          </div>
        )}
      </div>

      {!paintOnly && (
        <p className={`board-hint${view === "paint" ? " only-wide" : ""}`}>{hint}</p>
      )}

      {view === "paint" && maybe && (
        <div className="brush-row only-wide">
          <span>{t("Paint as")}</span>
          <div className="seg seg-sm" role="group" aria-label={t("Paint as")}>
            <button
              type="button"
              className={brush === "yes" ? "active" : ""}
              aria-pressed={brush === "yes"}
              onClick={() => setBrush("yes")}
            >
              <span className="swatch swatch-me" /> {t("Free")}
            </button>
            <button
              type="button"
              className={brush === "maybe" ? "active" : ""}
              aria-pressed={brush === "maybe"}
              onClick={() => setBrush("maybe")}
            >
              <span className="swatch swatch-maybe" /> {t("If needed")}
            </button>
          </div>
          <span className="muted small">
            {t("“If needed” means possible but not ideal. It's used only when no time works for everyone.")}
          </span>
        </div>
      )}

      {view === "paint" ? (
        <>
          <div className="only-wide">
            <AvailabilityGrid
              slots={slots}
              tz={tz}
              weekdayOnly={weekdayOnly}
              selected={selected}
              onChange={onChange}
              ghost={othersTotal > 0 ? ghost : undefined}
              maybe={maybe}
              brush={brush}
            />
          </div>
          <div className="only-narrow">
            <DayList
              slots={slots}
              tz={tz}
              weekdayOnly={weekdayOnly}
              selected={selected}
              onChange={onChange}
              othersFree={othersFree}
              othersTotal={othersTotal}
              maybe={maybe}
            />
          </div>
        </>
      ) : (
        <>
          <Heatmap
            slots={slots}
            tz={tz}
            weekdayOnly={weekdayOnly}
            total={total}
            statsByMs={statsByMs}
            nameOf={nameOfWithMe}
            highlight={highlight}
            focusMs={focus}
            onFocusSlot={setFocus}
          />
          {!onFocusSlot && (
            <div className="hover-line">
              {focus !== null && focusStat
                ? `${formatSlot(focus, tz)}: ${
                    focusStat.available.length
                      ? t("{names} free", { names: focusStat.available.map(nameOfWithMe).join(", ") })
                      : t("nobody free")
                  }${
                    focusStat.maybe?.length
                      ? ` · ${t("if needed: {names}", { names: focusStat.maybe.map(nameOfWithMe).join(", ") })}`
                      : ""
                  }`
                : t("Hover or tap the grid to see who is free at any time.")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
