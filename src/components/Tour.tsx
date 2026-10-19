import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
/** Where the card sits: under the target, over it, or pinned to the bottom (tall targets). */
type Placement = "below" | "above" | "pinned";

const PAD = 8;
const GAP = 12;
const EDGE = 16;
const POP_W = 320;
const MOVE_MS = 450;

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: Rect, b: Rect, k: number): Rect => ({
  top: a.top + (b.top - a.top) * k,
  left: a.left + (b.left - a.left) * k,
  width: a.width + (b.width - a.width) * k,
  height: a.height + (b.height - a.height) * k,
});

function targetOf(step: Step | undefined): Element | null {
  return step ? document.querySelector(`[data-tour="${step.target}"]`) : null;
}

function padded(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

/**
 * A step-by-step spotlight over the home page. Esc or “Skip” ends it.
 *
 * Positions are set straight on the elements every animation frame (no React
 * re-render), so the spotlight follows the page while it scrolls, and glides
 * from one target to the next with an ease-in-out curve.
 */
export default function Tour({ onClose }: { onClose: () => void }) {
  const steps = useMemo(() => STEPS.filter((s) => targetOf(s)), []);
  const [i, setI] = useState(0);
  const step = steps[i];
  const spotRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const shown = useRef<Rect | null>(null);
  /** A glide in progress: to where the target will be once the page has scrolled to `scrollTop`. */
  const move = useRef<{ from: Rect; to: Rect; start: number; scrollTop: number } | null>(null);
  const placement = useRef<Placement>("below");

  // New step: plan the scroll so the target and the card both fit, then glide there.
  useLayoutEffect(() => {
    const el = targetOf(step);
    if (!el) return;
    const vh = window.innerHeight;
    const popH = popRef.current?.offsetHeight ?? 210;
    const r = el.getBoundingClientRect();
    const glide = (to: Rect, scrollTop: number) => {
      move.current = { from: shown.current ?? to, to, start: performance.now(), scrollTop };
    };

    if (el.closest(".topbar")) {
      // The top bar never scrolls away.
      placement.current = "below";
      glide(padded(el), window.scrollY);
      return;
    }
    const header = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
    const room = vh - header - EDGE * 2;
    const need = r.height + PAD * 2 + GAP + popH;
    const fits = need <= room;
    const docTop = r.top + window.scrollY - PAD;
    const maxScroll = document.documentElement.scrollHeight - vh;
    const wanted = docTop - header - EDGE - (fits ? (room - need) / 2 : 0);
    const top = Math.round(Math.max(0, Math.min(wanted, maxScroll)));

    // Measure where the target lands at that scroll position (sticky columns
    // don't move with the page), then go back and scroll there smoothly. All
    // before the next paint, so the jump is never seen.
    const startTop = window.scrollY;
    window.scrollTo({ top, behavior: "instant" });
    const landed = padded(el);
    window.scrollTo({ top: startTop, behavior: "instant" });
    window.scrollTo({ top, behavior: "smooth" });
    glide(landed, top);
    const finalTop = landed.top;
    if (!fits) placement.current = "pinned";
    else placement.current = finalTop + landed.height + GAP + popH <= vh - EDGE ? "below" : "above";
  }, [step]);

  // Follow the target every frame.
  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      const el = targetOf(step);
      const spot = spotRef.current;
      const pop = popRef.current;
      if (el && spot && pop) {
        const target = padded(el);
        let r = target;
        const m = move.current;
        if (m) {
          // Glide to where the target will end up, independent of the page's
          // own smooth scroll, and wait there until the scroll arrives (or
          // the visitor scrolls somewhere else), so it never overshoots.
          const k = Math.min(1, (now - m.start) / MOVE_MS);
          r = lerp(m.from, m.to, ease(k));
          const arrived = Math.abs(window.scrollY - m.scrollTop) < 1 || now - m.start > 1500;
          if (k >= 1 && arrived) {
            move.current = null;
            r = target;
          }
        }
        shown.current = r;
        spot.style.transform = `translate(${r.left}px, ${r.top}px)`;
        spot.style.width = `${r.width}px`;
        spot.style.height = `${r.height}px`;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = Math.min(POP_W, vw - EDGE * 2);
        const h = pop.offsetHeight;
        const left = Math.min(Math.max(EDGE, r.left), vw - w - EDGE);
        let top =
          placement.current === "below"
            ? r.top + r.height + GAP
            : placement.current === "above"
            ? r.top - GAP - h
            : vh - h - EDGE;
        top = Math.max(EDGE, Math.min(top, vh - h - EDGE));
        pop.style.width = `${w}px`;
        pop.style.transform = `translate(${left}px, ${top}px)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [step]);

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

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label={t("Tutorial")}>
      <div className="tour-spot" ref={spotRef} />
      <div className="tour-pop" ref={popRef}>
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
