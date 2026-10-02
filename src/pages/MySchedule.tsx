import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import AvailabilityGrid from "../components/AvailabilityGrid";
import DayList from "../components/DayList";
import TimezonePicker from "../components/TimezonePicker";
import Icon from "../components/Icon";
import { blockKey, blockOf, referenceWeekSlots, saveSchedule } from "../lib/schedule";
import { detectTz } from "../lib/slots";
import { useMySchedule } from "../lib/useMySchedule";
import { isFirebaseConfigured, signInWithGoogle } from "../firebase";
import { t } from "../lib/i18n";

type SaveState = "idle" | "saving" | "saved" | "error";

/** 7 → "7 AM" (or "7:00" in Chinese). */
const hourText = (h: number) => DateTime.fromObject({ hour: h % 24 }).toFormat("h a");

/** Hours shown by default; the rest of the day is one click away. */
const DAY_START = 7;
const DAY_END = 22;

const PRESETS: { label: string; days: number[]; start: number; end: number }[] = [
  { label: "Weekdays 9–5", days: [1, 2, 3, 4, 5], start: 9, end: 17 },
  { label: "Weekday mornings", days: [1, 2, 3, 4, 5], start: 9, end: 12 },
  { label: "Weekday evenings", days: [1, 2, 3, 4, 5], start: 18, end: 21 },
];

export default function MySchedule() {
  const { signedIn, uid, schedule, setSchedule } = useMySchedule();
  const [tz, setTz] = useState(detectTz());
  const [blocks, setBlocks] = useState<Set<string>>(new Set());
  const [fullDay, setFullDay] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [signingIn, setSigningIn] = useState(false);
  const loaded = useRef(false);

  // Seed from the saved schedule once it arrives.
  useEffect(() => {
    if (loaded.current || schedule === undefined) return;
    loaded.current = true;
    if (schedule) {
      setTz(schedule.tz);
      setBlocks(new Set(schedule.blocks));
      setSaveState("saved");
      // Show the whole day if the saved times reach outside the default hours.
      if (schedule.blocks.some((b) => {
        const min = Number(b.split("-")[1]);
        return min < DAY_START * 60 || min >= DAY_END * 60;
      })) setFullDay(true);
    }
  }, [schedule]);

  // Autosave shortly after the last change.
  useEffect(() => {
    if (!dirty || !uid) return;
    const t = window.setTimeout(async () => {
      setDirty(false);
      setSaveState("saving");
      const next = { tz, blocks: [...blocks].sort(), updatedAt: Date.now() };
      try {
        await saveSchedule(uid, next);
        setSchedule(next);
        setSaveState("saved");
      } catch (e) {
        console.error("Couldn't save your schedule", e);
        setSaveState("error");
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [dirty, uid, tz, blocks, setSchedule]);

  const slots = useMemo(
    () => (fullDay ? referenceWeekSlots(tz, 0, 24) : referenceWeekSlots(tz, DAY_START, DAY_END)),
    [tz, fullDay]
  );
  const selected = useMemo(
    () => new Set(slots.filter((ms) => blocks.has(blockOf(ms, tz)))),
    [slots, blocks, tz]
  );

  function change(next: Set<string>) {
    setBlocks(next);
    setDirty(true);
  }
  // Rebuild from the visible slots, keeping blocks in hidden hours.
  function paint(nextSlots: Set<number>) {
    const next = new Set(blocks);
    for (const ms of slots) next.delete(blockOf(ms, tz));
    for (const ms of nextSlots) next.add(blockOf(ms, tz));
    change(next);
  }

  if (!isFirebaseConfigured) {
    return <p className="muted">{t("Firebase isn't configured yet (see README).")}</p>;
  }

  if (!signedIn) {
    return (
      <div className="narrow">
        <div className="card state-card schedule-signin">
          <h1 className="page-title">{t("My schedule")}</h1>
          <p className="page-sub">
            {t("Save the times you're usually free each week. Then, in any poll, one click fills them in, converted to that poll's timezone.")}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={signingIn}
            onClick={() => {
              setSigningIn(true);
              signInWithGoogle()
                .catch(() => {})
                .finally(() => setSigningIn(false));
            }}
          >
            <Icon name="user" /> {t("Sign in with Google to start")}
          </button>
          <p className="hint schedule-note">
            {t("Your schedule is private. Others only see the times you put into a poll.")}
          </p>
        </div>
      </div>
    );
  }

  if (schedule === undefined) return <p className="muted">{t("Loading…")}</p>;

  const statusText =
    saveState === "error"
      ? t("Couldn't save")
      : dirty || saveState === "saving"
      ? t("Saving…")
      : saveState === "saved"
      ? t("Saved")
      : "";

  return (
    <div>
      <div className="page-head page-head-row">
        <div>
          <h1 className="page-title">{t("My schedule")}</h1>
          <p className="page-sub">
            {t("The times you're usually free each week. In any poll, “Fill from my schedule” marks these for you, converted to that poll's timezone.")}
          </p>
        </div>
        {statusText && (
          <span className={`save-pill ${saveState === "error" ? "warn" : dirty || saveState === "saving" ? "busy" : "ok"}`} role="status">
            <span className="dot" />
            {statusText}
          </span>
        )}
      </div>

      <section className="card">
        <div className="schedule-tools">
          <div className="schedule-tz">
            <TimezonePicker
              value={tz}
              onChange={(z) => {
                setTz(z);
                setDirty(true);
              }}
              label={t("My timezone")}
            />
          </div>
          <div className="schedule-presets">
            <span className="field-label">{t("Quick start")}</span>
            <div className="chips">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  className="chip"
                  onClick={() => {
                    const next = new Set(blocks);
                    for (const d of p.days)
                      for (let m = p.start * 60; m < p.end * 60; m += 30) next.add(blockKey(d, m));
                    change(next);
                  }}
                >
                  <Icon name="plus" size={14} /> {t(p.label)}
                </button>
              ))}
              {blocks.size > 0 && (
                <button type="button" className="chip" onClick={() => change(new Set())}>
                  <Icon name="x" size={14} /> {t("Clear all")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="results-head schedule-grid-head">
          <p className="board-hint board-hint-inline">
            {t("Click or drag to mark when you're usually free.")}
          </p>
          <button type="button" className="link-btn" onClick={() => setFullDay((f) => !f)}>
            {fullDay ? t("Show {a} – {b} only", { a: hourText(DAY_START), b: hourText(DAY_END) }) : t("Show all 24 hours")}
          </button>
        </div>
        <div className="only-wide">
          <AvailabilityGrid slots={slots} tz={tz} weekdayOnly selected={selected} onChange={paint} />
        </div>
        <div className="only-narrow">
          <DayList
            slots={slots}
            tz={tz}
            weekdayOnly
            selected={selected}
            onChange={paint}
            othersFree={new Map()}
            othersTotal={0}
          />
        </div>
        <p className="hint schedule-note">
          <Icon name="info" className="icon-brand" />{" "}
          {t("Private to you. Nothing is filled in automatically: in each poll you choose when to use it, and you can still adjust that week.")}
        </p>
      </section>
    </div>
  );
}
