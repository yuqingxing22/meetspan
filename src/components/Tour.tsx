import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "../lib/i18n";

/** Fired on window to start the tutorial (the home page listens). */
export const TOUR_EVENT = "meetspan:tour";

export function startTour(): void {
  // After navigation, so the home page has rendered its targets.
  window.setTimeout(() => window.dispatchEvent(new Event(TOUR_EVENT)), 50);
}

interface Step {
  /** `data-tour` value of the element to point at. Steps whose target isn't on the page are skipped. */
  target: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: "basics",
    title: "Name your meeting",
    body: "Give the meeting a name and add your own name. Guests see both on the invite.",
  },
  {
    target: "tz",
    title: "Choose your timezone",
    body: "The days and hours you pick are read in this timezone. Each guest sees them converted to their own. MeetSpan remembers your choice for next time.",
  },
  {
    target: "days",
    title: "Pick the days",
    body: "Click specific dates (hold Shift to select a range), or switch to “Repeats weekly” for a regular meeting.",
  },
  {
    target: "hours",
    title: "Set the hours",
    body: "Use a preset or set your own. Your last 3 custom hours are saved here so you can reuse them in one click.",
  },
  {
    target: "create",
    title: "Create and share",
    body: "Check the preview, then create the poll. You get an invite link for your group and a private link to manage the poll.",
  },
  {
    target: "polls",
    title: "Your polls",
    body: "Your latest polls are here. Use “Batch actions” to close or delete several at once, and “More” to see them all.",
  },
  {
    target: "settings",
    title: "Settings",
    body: "Change the theme color, text size and clock, set your usual weekly times, and manage all your polls.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const POP_W = 320;

/** A step-by-step spotlight over the home page. Esc or “Skip” ends it. */
export default function Tour({ onClose }: { onClose: () => void }) {
  const steps = useMemo(() => STEPS.filter((s) => document.querySelector(`[data-tour="${s.target}"]`)), []);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[i];

  const measure = useCallback(() => {
    const el = step && document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  // Bring the target into view, then follow it while the page scrolls or resizes.
  useLayoutEffect(() => {
    const el = step && document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;
    const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
    el.scrollIntoView({ block: tall ? "start" : "center", behavior: "smooth" });
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    // Smooth scrolling fires scroll events, but measure once more when it settles.
    const settle = window.setTimeout(measure, 450);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.clearTimeout(settle);
    };
  }, [step, measure]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  if (!step) return null;
  const last = i === steps.length - 1;

  // Below the target if it fits, otherwise above, otherwise pinned to the bottom.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(POP_W, vw - 32);
  let top = vh - 220;
  let left = (vw - width) / 2;
  if (rect) {
    left = Math.min(Math.max(16, rect.left), vw - width - 16);
    if (rect.top + rect.height + 200 < vh) top = rect.top + rect.height + 12;
    else if (rect.top > 212) top = rect.top - 12 - 200;
    top = Math.max(16, Math.min(top, vh - 216));
  }

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label={t("Tutorial")}>
      {rect ? (
        <div
          className="tour-spot"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-pop" style={{ top, left, width }}>
        <div className="tour-count">
          {t("Step {n} of {total}", { n: i + 1, total: steps.length })}
        </div>
        <h2 className="tour-title">{t(step.title)}</h2>
        <p className="tour-body">{t(step.body)}</p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((s, k) => (
            <span key={s.target} className={k === i ? "on" : ""} />
          ))}
        </div>
        <div className="tour-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t("Skip")}
          </button>
          <div className="btn-row">
            {i > 0 && (
              <button type="button" className="btn btn-sm" onClick={() => setI(i - 1)}>
                {t("Back")}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              autoFocus
              onClick={() => (last ? onClose() : setI(i + 1))}
            >
              {last ? t("Done") : t("Next")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
