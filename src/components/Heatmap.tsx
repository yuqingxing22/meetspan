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

        {model.rows.map((r) => (
          <div key={r.key} style={{ display: "contents" }}>
            <div className="grid-time-head">{r.label}</div>
            {model.columns.map((c) => {
              const ms = model.cells.get(`${c.key}|${r.key}`);
              if (ms === undefined) {
                return <div key={c.key} className="cell empty" />;
              }
              const stat = statsByMs.get(ms) ?? { count: 0, available: [] };
              const names = stat.available.map(nameOf).join(", ");
              const cls = [
                "cell",
                `h${level(stat.count)}`,
                highlight?.has(ms) ? "best" : "",
              ]
                .filter(Boolean)
                .join(" ");
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
        ))}
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
