import { DateTime } from "luxon";
import Icon from "./Icon";
import { formatRange } from "../lib/slots";
import { windowComfort, type Comfort } from "../lib/comfort";
import type { ComputeResult, Session } from "../lib/overlap";
import type { Participant, PollMeta } from "../lib/types";

interface Props {
  result: ComputeResult;
  meta: PollMeta;
  participants: Participant[];
  nameOf: (id: string) => string;
  onUse: (sessions: Session[]) => void;
  /** Preview an option on the grid (null when the pointer leaves it). */
  onHover?: (sessions: Session[] | null) => void;
  /** Start of the session that's currently locked in, if any. */
  chosenStart?: number | null;
}

function OptionCard({
  sessions,
  label,
  tone,
  detail,
  meta,
  participants,
  nameOf,
  total,
  primary,
  onUse,
  onHover,
  chosen,
  stretched = [],
}: {
  stretched?: string[];
  sessions: Session[];
  label: string;
  tone: "ok" | "brand" | "muted";
  detail?: string;
  meta: PollMeta;
  participants: Participant[];
  nameOf: (id: string) => string;
  total: number;
  primary: boolean;
  onUse: (sessions: Session[]) => void;
  onHover?: (sessions: Session[] | null) => void;
  chosen: boolean;
}) {
  const first = sessions[0];
  const missing = Array.from(new Set(sessions.flatMap((s) => s.missing)));
  const minFree = Math.min(...sessions.map((s) => s.count));
  // Each person's worst hour across the option's sessions, in their timezone.
  const rank: Record<Comfort, number> = { day: 0, edge: 1, night: 2 };
  const comfortOf = (tz: string): Comfort =>
    sessions
      .map((s) => windowComfort(s.startMs, s.endMs, tz))
      .reduce((a, c) => (rank[c] > rank[a] ? c : a), "day" as Comfort);
  const attending = participants.filter((p) => !missing.includes(p.id));
  const nightNames = attending.filter((p) => comfortOf(p.tz) === "night").map((p) => p.codename);
  const edgeNames = attending.filter((p) => comfortOf(p.tz) === "edge").map((p) => p.codename);
  return (
    <div
      className={`option-card${chosen ? " chosen" : ""}`}
      onMouseEnter={() => onHover?.(sessions)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="option-top">
        <span className={`badge badge-${tone}`}>{label}</span>
        <span className="muted small">
          {minFree} of {total} free
          {sessions.length > 1 ? ` · ${sessions.length} sessions` : ""}
        </span>
      </div>
      {sessions.map((s, i) => (
        <div key={i} className="option-title">
          {formatRange(s.startMs, s.endMs, meta.organizerTz)}
        </div>
      ))}
      {detail && <p className="option-detail">{detail}</p>}
      <div className="bar">
        <span
          className={minFree === total ? "bar-ok" : ""}
          style={{ width: `${(minFree / Math.max(total, 1)) * 100}%` }}
        />
      </div>
      <div className="chips chips-sm">
        {participants.map((p) => {
          const ok = !missing.includes(p.id);
          const local = DateTime.fromMillis(first.startMs, { zone: p.tz });
          const c = comfortOf(p.tz);
          return (
            <span
              key={p.id}
              className={`chip chip-static${!ok ? " chip-miss" : c === "night" ? " chip-night" : c === "edge" ? " chip-edge" : ""}`}
            >
              {ok && c === "night" && <Icon name="moon" size={12} />}
              {meta.requiredIds?.includes(p.id) && <span className="req-star" aria-label="must attend">★</span>}
              {p.codename} · {local.toFormat("h:mm a ccc")}
              {stretched.includes(p.id) && <span className="chip-flag">if needed</span>}
            </span>
          );
        })}
      </div>
      {(nightNames.length > 0 || edgeNames.length > 0) && (
        <p className="comfort-text">
          {nightNames.length > 0 && (
            <span className="comfort comfort-night">
              <Icon name="moon" size={13} /> Late night for {nightNames.join(" and ")}
            </span>
          )}
          {edgeNames.length > 0 && (
            <span className="comfort comfort-edge">
              Outside work hours for {edgeNames.join(" and ")}
            </span>
          )}
        </p>
      )}
      {stretched.length > 0 && (
        <p className="option-detail">
          {stretched.map(nameOf).join(" and ")} would use {stretched.length === 1 ? "a time" : "times"} marked “if needed”.
        </p>
      )}
      {missing.length > 0 && (
        <p className="miss-text">
          {missing.map(nameOf).join(" and ")} can't make{" "}
          {sessions.length > 1 ? "every session" : "it"}
        </p>
      )}
      <button
        type="button"
        className={`btn btn-block ${chosen ? "btn-success" : primary ? "btn-primary" : ""}`}
        onClick={() => onUse(sessions)}
      >
        {chosen ? (
          <>
            <Icon name="check" /> Picked
          </>
        ) : sessions.length > 1 ? (
          "Pick these times"
        ) : (
          "Pick this time"
        )}
      </button>
    </div>
  );
}

export default function ResultPanel({
  result,
  meta,
  participants,
  nameOf,
  onUse,
  onHover,
  chosenStart,
}: Props) {
  const { total } = result;
  const common = { meta, participants, nameOf, total, onUse, onHover };
  const isChosen = (ss: Session[]) => chosenStart != null && ss[0]?.startMs === chosenStart;

  return (
    <div className="options">
      {result.kind === "ok" ? (
        <OptionCard
          {...common}
          sessions={result.sessions}
          label="Recommended · everyone can make it"
          tone="ok"
          primary
          chosen={isChosen(result.sessions)}
        />
      ) : (
        <div className="notice notice-warn">
          No single time fits everyone for the full meeting. Here are the closest
          options.
        </div>
      )}

      {result.suggestions.map((s, i) =>
        s.sessions && s.sessions.length > 0 ? (
          <OptionCard
            {...common}
            key={i}
            sessions={s.sessions}
            label={s.title}
            tone={result.kind === "none" && i === 0 ? "brand" : "muted"}
            detail={s.detail}
            stretched={s.stretched}
            primary={result.kind === "none" && i === 0}
            chosen={isChosen(s.sessions)}
          />
        ) : (
          <div key={i} className="option-card option-note">
            <b>{s.title}</b>
            <p className="option-detail">{s.detail}</p>
          </div>
        )
      )}
    </div>
  );
}
