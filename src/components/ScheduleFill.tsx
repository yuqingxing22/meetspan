import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { applySchedule } from "../lib/schedule";
import { useMySchedule } from "../lib/useMySchedule";
import { isFirebaseConfigured, signInWithGoogle } from "../firebase";

interface Props {
  /** The poll's slots. */
  slots: number[];
  selected: Set<number>;
  onFill: (next: Set<number>) => void;
}

/**
 * "Fill from my schedule": one click paints a poll from the signed-in user's
 * saved weekly availability. It replaces the current selection (with Undo);
 * nothing is filled automatically, so a week with exceptions isn't submitted
 * by accident.
 */
export default function ScheduleFill({ slots, selected, onFill }: Props) {
  const { signedIn, schedule } = useMySchedule();
  const [undo, setUndo] = useState<{ prev: Set<number>; filled: number } | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  if (!isFirebaseConfigured) return null;

  if (!signedIn) {
    return (
      <div className="fill-bar">
        <Icon name="calendar" className="icon-brand" />
        <span>
          Same times every week?{" "}
          <button
            type="button"
            className="link-btn link-inline"
            disabled={signingIn}
            onClick={() => {
              setSigningIn(true);
              signInWithGoogle()
                .catch(() => {})
                .finally(() => setSigningIn(false));
            }}
          >
            Sign in with Google
          </button>{" "}
          to save your usual schedule and fill any poll in one click.
        </span>
      </div>
    );
  }

  if (schedule === undefined) return null;

  if (schedule === null || schedule.blocks.length === 0) {
    return (
      <div className="fill-bar">
        <Icon name="calendar" className="icon-brand" />
        <span>
          Save your usual weekly times once, then fill any poll in one click.{" "}
          <Link to="/schedule" className="link-inline">
            Set up my schedule
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
          setUndo({ prev: new Set(selected), filled: next.size });
          onFill(next);
        }}
      >
        <Icon name="calendar" /> Fill from my schedule
      </button>
      {undo ? (
        <span className="fill-note" role="status">
          {undo.filled > 0
            ? `Filled ${undo.filled} ${undo.filled === 1 ? "slot" : "slots"}. Adjust anything that's different this time.`
            : "Your usual schedule doesn't overlap this poll's times."}{" "}
          <button
            type="button"
            className="link-btn link-inline"
            onClick={() => {
              onFill(undo.prev);
              setUndo(null);
            }}
          >
            Undo
          </button>
        </span>
      ) : (
        <span className="fill-note">
          Replaces what's marked here with your usual times.{" "}
          <Link to="/schedule" className="link-inline">
            Edit schedule
          </Link>
        </span>
      )}
    </div>
  );
}
