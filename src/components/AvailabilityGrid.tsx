import { useRef } from "react";
import { buildGridModel } from "../lib/slots";

interface Props {
  slots: number[];
  tz: string;
  /** Show weekday-only column labels (Mon/Wed) instead of dated ones. */
  weekdayOnly?: boolean;
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
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
}: Props) {
  const model = buildGridModel(slots, tz, { weekdayOnly });
  const dragging = useRef(false);
  const mode = useRef<"add" | "remove">("add");
  const working = useRef<Set<number>>(selected);
  working.current = selected;

  function apply(ms: number) {
    const next = new Set(working.current);
    if (mode.current === "add") next.add(ms);
    else next.delete(ms);
    if (next.size !== working.current.size) {
      working.current = next;
      onChange(next);
    }
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
    mode.current = selected.has(ms) ? "remove" : "add";
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
    gridTemplateColumns: `70px repeat(${model.columns.length}, var(--cellw))`,
  };

  return (
    <div className="grid-wrap">
      <div
        className="grid"
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

        {model.rows.map((r) => (
          <RowFragment
            key={r.key}
            rowKey={r.key}
            rowLabel={r.label}
            columns={model.columns}
            cells={model.cells}
            selected={selected}
          />
        ))}
      </div>
      <div className="legend">
        <span className="swatch" style={{ background: "var(--surface-2)" }} />
        <span>Busy</span>
        <span className="swatch" style={{ background: "var(--brand)" }} />
        <span>Available — click or drag to paint</span>
      </div>
    </div>
  );
}

function RowFragment({
  rowKey,
  rowLabel,
  columns,
  cells,
  selected,
}: {
  rowKey: number;
  rowLabel: string;
  columns: { key: string; label: string }[];
  cells: Map<string, number>;
  selected: Set<number>;
}) {
  return (
    <>
      <div className="grid-time-head">{rowLabel}</div>
      {columns.map((c) => {
        const ms = cells.get(`${c.key}|${rowKey}`);
        if (ms === undefined) {
          return <div key={c.key} className="cell empty" />;
        }
        return (
          <div
            key={c.key}
            data-slot={ms}
            className={`cell${selected.has(ms) ? " sel" : ""}`}
          />
        );
      })}
    </>
  );
}
