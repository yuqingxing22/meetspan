import { buildGridModel } from "../lib/slots";

export interface SlotStat {
  count: number;
  available: string[];
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
}: Props) {
  const model = buildGridModel(slots, tz, { weekdayOnly });
  const gridStyle = {
    gridTemplateColumns: `70px repeat(${model.columns.length}, var(--cellw))`,
  };

  function level(count: number): number {
    if (count <= 0 || total <= 0) return 0;
    return Math.min(5, Math.ceil((count / total) * 5));
  }

  return (
    <div className="grid-wrap">
      <div className="grid" style={gridStyle}>
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
                const cls =
                  `cell h${level(stat.count)}` +
                  (highlight?.has(ms) ? " best" : "") +
                  edge;
                return (
                  <div
                    key={c.key}
                    className={cls}
                    title={`${stat.count}/${total} free${
                      names ? ` — ${names}` : ""
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
      <div className="legend">
        <span>Fewer free</span>
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <span key={l} className={`swatch cell h${l}`} style={{ height: 14 }} />
        ))}
        <span>Everyone free</span>
      </div>
    </div>
  );
}
