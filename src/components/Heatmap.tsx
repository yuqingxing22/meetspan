import { buildGridModel } from "../lib/slots";
import { t } from "../lib/i18n";

export interface SlotStat {
  count: number;
  available: string[];
  /** People who marked this slot "if needed" (not counted as free). */
  maybe?: string[];
}

interface Props {
  slots: number[];
  tz: string;
  /** Show weekday-only column labels (Mon/Wed) instead of dated ones. */
  weekdayOnly?: boolean;
  total: number;
  statsByMs: Map<number, SlotStat>;
  nameOf: (id: string) => string;
  /** Slot start ms to outline as chosen/best. */
  highlight?: Set<number>;
  /** Slot to ring as the one being inspected. */
  focusMs?: number | null;
  /** Hover / tap on a slot (null when the pointer leaves the grid). */
  onFocusSlot?: (ms: number | null) => void;
}

export function heatLevel(count: number, total: number): number {
  if (count <= 0 || total <= 0) return 0;
  return Math.min(5, Math.ceil((count / total) * 5));
}

/** Aggregated When2Meet-style heatmap: darker = more people free. */
export default function Heatmap({
  slots,
  tz,
  weekdayOnly,
  total,
  statsByMs,
  nameOf,
  highlight,
  focusMs,
  onFocusSlot,
}: Props) {
  const model = buildGridModel(slots, tz, { weekdayOnly });
  // Slot length, to find where an outlined window starts and ends.
  let step = Infinity;
  for (let i = 1; i < slots.length; i++) step = Math.min(step, slots[i] - slots[i - 1]);
  const gridStyle = {
    gridTemplateColumns: `70px repeat(${model.columns.length}, minmax(var(--cellw), 1fr))`,
  };

  function slotFromEvent(e: React.PointerEvent | React.MouseEvent): number | null {
    const cell = (e.target as HTMLElement).closest("[data-slot]") as HTMLElement | null;
    if (!cell) return null;
    const ms = Number(cell.dataset.slot);
    return Number.isFinite(ms) ? ms : null;
  }

  return (
    <div className="grid-wrap">
      <div
        className="grid"
        style={gridStyle}
        onPointerMove={
          onFocusSlot
            ? (e) => {
                if (e.pointerType !== "mouse") return;
                const ms = slotFromEvent(e);
                if (ms !== null && ms !== focusMs) onFocusSlot(ms);
              }
            : undefined
        }
        onPointerLeave={
          onFocusSlot ? (e) => e.pointerType === "mouse" && onFocusSlot(null) : undefined
        }
        onClick={
          onFocusSlot
            ? (e) => {
                const ms = slotFromEvent(e);
                if (ms !== null) onFocusSlot(ms);
              }
            : undefined
        }
      >
        <div className="grid-corner" />
        {model.columns.map((c) => (
          <div key={c.key} className="grid-col-head">
            {c.label.split("\n").map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        ))}

        {model.rows.map((r, i) => {
          const first = i === 0;
          const last = i === model.rows.length - 1;
          return (
            <div key={r.key} style={{ display: "contents" }}>
              <div className={`grid-time-head${first ? " first" : ""}`}>
                {r.onHour && <span>{r.label}</span>}
              </div>
              {model.columns.map((c, ci) => {
                const edge =
                  (r.onHour ? " hour" : "") +
                  (last ? " row-last" : "") +
                  (ci === model.columns.length - 1 ? " col-last" : "");
                const ms = model.cells.get(`${c.key}|${r.key}`);
                if (ms === undefined) {
                  return <div key={c.key} className={`cell empty${edge}`} />;
                }
                const stat = statsByMs.get(ms) ?? { count: 0, available: [] };
                const names = stat.available.map(nameOf).join(", ");
                const maybeNames = (stat.maybe ?? []).map(nameOf).join(", ");
                const cls =
                  `cell heat h${heatLevel(stat.count, total)}` +
                  (highlight?.has(ms)
                    ? " best" +
                      (highlight.has(ms - step) ? "" : " best-top") +
                      (highlight.has(ms + step) ? "" : " best-bottom")
                    : "") +
                  (focusMs === ms ? " focus" : "") +
                  edge;
                return (
                  <div
                    key={c.key}
                    data-slot={ms}
                    className={cls}
                    title={`${t("{n}/{total} free", { n: stat.count, total })}${names ? ` — ${names}` : ""}${
                      maybeNames ? ` · ${t("if needed: {names}", { names: maybeNames })}` : ""
                    }`}
                  />
                );
              })}
            </div>
          );
        })}
        <div className="grid-time-end">
          <span>{model.endLabel}</span>
        </div>
      </div>
    </div>
  );
}
