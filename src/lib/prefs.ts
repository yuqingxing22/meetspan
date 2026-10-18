import { useEffect, useState } from "react";

/**
 * Personal settings (Settings page): look and feel, plus a few things
 * MeetSpan remembers for the next poll. Kept in this browser; prefsSync.ts
 * copies them to the visitor's Google account so they follow them around.
 */
export type Accent = "indigo" | "blue" | "teal" | "violet" | "rose";
export type TextSize = "sm" | "md" | "lg" | "xl";
/** "auto" follows the language: 12-hour in English, 24-hour in Chinese. */
export type Clock = "auto" | "12" | "24";

export interface CustomHours {
  start: number;
  end: number;
}

export interface Prefs {
  accent: Accent;
  textSize: TextSize;
  clock: Clock;
  /** First day of the week in calendars: 0 = Sunday, 1 = Monday. */
  weekStart: 0 | 1;
  /** Timezone picked last when creating a poll ("" = never picked). */
  tz: string;
  /** Custom daily hours used for recent polls, newest first, at most MAX_CUSTOM_HOURS. */
  customHours: CustomHours[];
  /** When these were last changed (ms); the newer copy wins when syncing. */
  updatedAt: number;
}

export const ACCENTS: Accent[] = ["indigo", "blue", "teal", "violet", "rose"];
export const TEXT_SIZES: TextSize[] = ["sm", "md", "lg", "xl"];
export const MAX_CUSTOM_HOURS = 3;

export const DEFAULT_PREFS: Prefs = {
  accent: "indigo",
  textSize: "md",
  clock: "auto",
  weekStart: 0,
  tz: "",
  customHours: [],
  updatedAt: 0,
};

const KEY = "meetspan.prefs";
/** Older browsers kept the timezone list here; its first entry seeds `tz`. */
const RECENT_TZS_KEY = "meetspan.recentTzs";

/** Keep only known values, so a hand-edited or older copy can't break the page. */
export function cleanPrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Prefs, unknown>>;
  const hours = Array.isArray(r.customHours) ? r.customHours : [];
  return {
    accent: ACCENTS.includes(r.accent as Accent) ? (r.accent as Accent) : DEFAULT_PREFS.accent,
    textSize: TEXT_SIZES.includes(r.textSize as TextSize) ? (r.textSize as TextSize) : DEFAULT_PREFS.textSize,
    clock: r.clock === "12" || r.clock === "24" ? r.clock : "auto",
    weekStart: r.weekStart === 1 ? 1 : 0,
    tz: typeof r.tz === "string" ? r.tz : "",
    customHours: hours
      .filter(
        (h): h is CustomHours =>
          !!h &&
          Number.isInteger((h as CustomHours).start) &&
          Number.isInteger((h as CustomHours).end) &&
          (h as CustomHours).start >= 0 &&
          (h as CustomHours).end <= 24 &&
          (h as CustomHours).start < (h as CustomHours).end
      )
      .slice(0, MAX_CUSTOM_HOURS)
      .map(({ start, end }) => ({ start, end })),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
  };
}

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return cleanPrefs(JSON.parse(raw));
    // First visit since settings existed: keep the zone picked last.
    const recent = JSON.parse(localStorage.getItem(RECENT_TZS_KEY) ?? "[]");
    return { ...DEFAULT_PREFS, tz: Array.isArray(recent) && typeof recent[0] === "string" ? recent[0] : "" };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let current: Prefs = typeof window === "undefined" ? { ...DEFAULT_PREFS } : read();
/** `fromAccount` is true when the change came from the account copy (don't write it back). */
type Listener = (p: Prefs, fromAccount: boolean) => void;
const listeners = new Set<Listener>();

export function getPrefs(): Prefs {
  return current;
}

/** Change some settings. `fromAccount` replaces them with the account's copy as-is. */
export function setPrefs(patch: Partial<Prefs>, opts: { fromAccount?: boolean } = {}): void {
  current = cleanPrefs({ ...current, ...patch, updatedAt: opts.fromAccount ? patch.updatedAt : Date.now() });
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode: settings last for this visit */
  }
  applyPrefs(current);
  listeners.forEach((fn) => fn(current, !!opts.fromAccount));
}

export function subscribePrefs(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The current settings, re-rendering on change. */
export function usePrefs(): Prefs {
  const [p, set] = useState(current);
  useEffect(() => subscribePrefs((next) => set(next)), []);
  return p;
}

/** Put `h` first in the recent custom hours (no duplicates, at most MAX_CUSTOM_HOURS). */
export function withCustomHours(list: CustomHours[], h: CustomHours): CustomHours[] {
  return [h, ...list.filter((x) => x.start !== h.start || x.end !== h.end)].slice(0, MAX_CUSTOM_HOURS);
}

export function rememberCustomHours(h: CustomHours): void {
  setPrefs({ customHours: withCustomHours(current.customHours, h) });
}

/** Theme colour and text size live on <html> as data attributes (see styles.css). */
export function applyPrefs(p: Prefs): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.dataset.accent = p.accent;
  el.dataset.textsize = p.textSize;
}

applyPrefs(current);
