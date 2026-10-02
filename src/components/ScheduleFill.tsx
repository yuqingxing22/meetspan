import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { applySchedule } from "../lib/schedule";
import { useMySchedule } from "../lib/useMySchedule";
import { isFirebaseConfigured } from "../firebase";
import { t } from "../lib/i18n";

interface Props {
  /** The poll's slots. */
  slots: number[];
  selected: Set<number>;
  /** Current "if needed" marks; a fill clears them (Undo restores them). */
  maybe?: Set<number>;
  onFill: (next: Set<number>, nextMaybe: Set<number>) => void;
}

/**
 * "Fill from my schedule": one click paints a poll from the visitor's
 * saved weekly availability (anonymous or Google). It replaces the current selection (with Undo);
 * nothing is filled automatically, so a week with exceptions isn't submitted
 * by accident.
 */
export default function ScheduleFill({ slots, selected, maybe, onFill }: Props) {
  const { schedule } = useMySchedule();
  const [undo, setUndo] = useState<{
    prev: Set<number>;
    prevMaybe: Set<number>;
    filled: number;
  } | null>(null);

  if (!isFirebaseConfigured) return null;

  if (schedule === undefined) return null;

  if (schedule === null || schedule.blocks.length === 0) {
    return (
      <div className="fill-bar">
        <Icon name="calendar" className="icon-brand" />
        <span>
          {t("Save your usual weekly times once, then fill any poll in one click.")}{" "}
          <Link to="/schedule" className="link-inline">
            {t("Set up my schedule")}
          </Link>
        </span>
      </div>
    );
  }

  return (
    <div className="fill-bar">
      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={() => {
          const next = applySchedule(slots, schedule);
          setUndo({ prev: new Set(selected), prevMaybe: new Set(maybe), filled: next.size });
          onFill(next, new Set());
        }}
      >
        <Icon name="calendar" /> {t("Fill from my schedule")}
      </button>
      {undo ? (
        <span className="fill-note" role="status">
          {undo.filled > 0
            ? t(
                undo.filled === 1
                  ? "Filled 1 slot. Adjust anything that's different this time."
                  : "Filled {n} slots. Adjust anything that's different this time.",
                { n: undo.filled }
              )
            : t("Your usual schedule doesn't overlap this poll's times.")}{" "}
          <button
            type="button"
            className="link-btn link-inline"
            onClick={() => {
              onFill(undo.prev, undo.prevMaybe);
              setUndo(null);
            }}
          >
            {t("Undo")}
          </button>
        </span>
      ) : (
        <span className="fill-note">
          {t("Replaces what's marked here with your usual times.")}{" "}
          <Link to="/schedule" className="link-inline">
            {t("Edit schedule")}
          </Link>
        </span>
      )}
    </div>
  );
}
