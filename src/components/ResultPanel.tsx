import { formatRange } from "../lib/slots";
import type { ComputeResult, Session } from "../lib/overlap";
import type { PollMeta } from "../lib/types";

interface Props {
  result: ComputeResult;
  meta: PollMeta;
  nameOf: (id: string) => string;
  onUse: (sessions: Session[]) => void;
}

function SessionPills({
  sessions,
  meta,
  total,
}: {
  sessions: Session[];
  meta: PollMeta;
  total: number;
}) {
  return (
    <div>
      {sessions.map((s, i) => (
        <span key={i} className="session-pill">
          {formatRange(s.startMs, s.endMs, meta.organizerTz)}
          <small>
            {s.count}/{total} free · {Math.round(
              (s.endMs - s.startMs) / 60000
            )}{" "}
            min
          </small>
        </span>
      ))}
    </div>
  );
}

export default function ResultPanel({ result, meta, nameOf, onUse }: Props) {
  const { total } = result;

  return (
    <div>
      {result.kind === "ok" ? (
        <div className="card result-good">
          <h2>✓ Found a time everyone can make</h2>
          <p className="hint">
            Shown in your timezone ({meta.organizerTz.replace(/_/g, " ")}).
          </p>
          <SessionPills sessions={result.sessions} meta={meta} total={total} />
          <div className="spacer" />
          <button
            className="btn btn-primary"
            onClick={() => onUse(result.sessions)}
          >
            Use these times & draft email →
          </button>
        </div>
      ) : (
        <div className="card result-warn">
          <h2>No single time fits everyone for the full duration</h2>
          <p className="hint">
            Here's what the numbers say and a few ways forward:
          </p>
        </div>
      )}

      {result.suggestions.map((s, i) => (
        <div key={i} className="suggestion">
          <b>{s.title}</b>
          <div className="muted" style={{ margin: "4px 0 8px" }}>
            {s.detail}
          </div>
          {s.excluded && s.excluded.length > 0 && (
            <div className="muted" style={{ marginBottom: 8 }}>
              Would leave out: {s.excluded.map(nameOf).join(", ")}
            </div>
          )}
          {s.sessions && s.sessions.length > 0 && (
            <>
              <SessionPills sessions={s.sessions} meta={meta} total={total} />
              <div className="spacer" />
              <button
                className="btn btn-sm"
                onClick={() => onUse(s.sessions!)}
              >
                Use these times & draft email →
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
