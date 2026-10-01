import { useRef } from "react";
import { buildGridModel } from "../lib/slots";

interface Props {
  slots: number[];
  tz: string;
  /** Show weekday-only column labels (Mon/Wed) instead of dated ones. */
  weekdayOnly?: boolean;
  selected: Set<number>;
  /**
   * Called with the new "free" set — and, when `maybe` is given, the new
   * "if needed" set as well.
   */
  onChange: (next: Set<number>, nextMaybe?: Set<number>) => void;
  /** Faint background level 0–5 per slot (how many others are free). */
  ghost?: Map<number, number>;
  /** "If needed" slots. Omit to paint plain free/busy. */
  maybe?: Set<number>;
  /** Which mark painting applies when `maybe` is used. */
  brush?: "yes" | "maybe";
}

/**
 * Paintable availability grid. Renders the poll's absolute slots in the
 * viewer's own timezone and supports click + drag painting (mouse & touch).
 */
export default function AvailabilityGrid({
  slots,
  tz,
  weekdayOnly,
  selected,
  onChange,
  ghost,
  maybe,
  brush = "yes",
}: Props) {
  const model = buildGridModel(slots, tz, { weekdayOnly });
  const dragging = useRef(false);
  const mode = useRef<"add" | "remove">("add");
  const working = useRef<Set<number>>(selected);
  const workingMaybe = useRef<Set<number> | undefined>(maybe);
  working.current = selected;
  workingMaybe.current = maybe;

  function apply(ms: number) {
    const yes = working.current;
    const may = workingMaybe.current;
    if (!may) {
      const next = new Set(yes);
      if (mode.current === "add") next.add(ms);
      else next.delete(ms);
      if (next.size !== yes.size) {
        working.current = next;
        onChange(next);
      }
      return;
    }
    // Two marks: painting one removes the other from that slot.
    const target = brush === "maybe" ? may : yes;
    const other = brush === "maybe" ? yes : may;
    const nextTarget = new Set(target);
    const nextOther = new Set(other);
    if (mode.current === "add") {
      nextTarget.add(ms);
      nextOther.delete(ms);
    } else nextTarget.delete(ms);
    if (nextTarget.size === target.size && nextOther.size === other.size) return;
    const nextYes = brush === "maybe" ? nextOther : nextTarget;
    const nextMaybe = brush === "maybe" ? nextTarget : nextOther;
    working.current = nextYes;
    workingMaybe.current = nextMaybe;
    onChange(nextYes, nextMaybe);
  }

  function slotAtPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const cell = el?.closest("[data-slot]") as HTMLElement | null;
    if (!cell) return null;
    const ms = Number(cell.dataset.slot);
    return Number.isFinite(ms) ? ms : null;
  }

  function onPointerDown(e: React.PointerEvent) {
    const ms = slotAtPoint(e.clientX, e.clientY);
    if (ms === null) return;
    dragging.current = true;
    const target = maybe && brush === "maybe" ? maybe : selected;
    mode.current = target.has(ms) ? "remove" : "add";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    apply(ms);
    e.preventDefault();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const ms = slotAtPoint(e.clientX, e.clientY);
    if (ms !== null) apply(ms);
  }

  function endDrag() {
    dragging.current = false;
  }

  const gridStyle = {
    gridTemplateColumns: `70px repeat(${model.columns.length}, minmax(var(--cellw), 1fr))`,
  };

  return (
    <div className="grid-wrap">
      <div
        className="grid grid-paint"
        style={gridStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="grid-corner" />
        {model.columns.map((c) => (
          <div key={c.key} className="grid-col-head">
            {c.label.split("\n").map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        ))}

        {model.rows.map((r, i) => (
          <RowFragment
            key={r.key}
            rowKey={r.key}
            rowLabel={r.label}
            onHour={r.onHour}
            first={i === 0}
            last={i === model.rows.length - 1}
            columns={model.columns}
            cells={model.cells}
            selected={selected}
            ghost={ghost}
            maybe={maybe}
          />
        ))}
        <div className="grid-time-end">
          <span>{model.endLabel}</span>
        </div>
      </div>
    </div>
  );
}

function RowFragment({
  rowKey,
  rowLabel,
  onHour,
  first,
  last,
  columns,
  cells,
  selected,
  ghost,
  maybe,
}: {
  rowKey: number;
  rowLabel: string;
  onHour: boolean;
  first: boolean;
  last: boolean;
  columns: { key: string; label: string }[];
  cells: Map<string, number>;
  selected: Set<number>;
  ghost?: Map<number, number>;
  maybe?: Set<number>;
}) {
  return (
    <>
      <div className={`grid-time-head${first ? " first" : ""}`}>
        {onHour && <span>{rowLabel}</span>}
      </div>
      {columns.map((c, ci) => {
        const edge =
          (onHour ? " hour" : "") +
          (last ? " row-last" : "") +
          (ci === columns.length - 1 ? " col-last" : "");
        const ms = cells.get(`${c.key}|${rowKey}`);
        if (ms === undefined) {
          return <div key={c.key} className={`cell empty${edge}`} />;
        }
        return (
          <div
            key={c.key}
            data-slot={ms}
            className={`cell${
              selected.has(ms)
                ? " sel"
                : maybe?.has(ms)
                ? " maybe"
                : ghost
                ? ` g${ghost.get(ms) ?? 0}`
                : ""
            }${edge}`}
          />
        );
      })}
    </>
  );
}
