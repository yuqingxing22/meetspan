import { useEffect, useState } from "react";
import { MEETING_TYPES, type MeetingType } from "./types";

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

/** A user-defined email category: its name and the text sent for it (see fillTemplate in email.ts). */
export interface EmailTemplate {
  id: string;
  /** Set when this is the user's edited copy of a built-in category; it replaces the built-in text. */
  builtin?: MeetingType;
  /** The category name shown in the template lists, e.g. "Lab meeting". */
  name: string;
  subject: string;
  /** Email for a confirmed time. */
  body: string;
  /** Email when several times are sent as options; empty uses `body`. */
  optionsBody: string;
}

export interface Prefs {
  /** What to call the user: the default organizer name and answer name. */
  name: string;
  accent: Accent;
  textSize: TextSize;
  clock: Clock;
  /** First day of the week in calendars: 0 = Sunday, 1 = Monday. */
  weekStart: 0 | 1;
  /** Timezone picked last when creating a poll ("" = never picked). */
  tz: string;
  /** Custom daily hours used for recent polls, newest first, at most MAX_CUSTOM_HOURS. */
  customHours: CustomHours[];
  /** The user's own email categories and templates. */
  templates: EmailTemplate[];
  /** When these were last changed (ms); the newer copy wins when syncing. */
  updatedAt: number;
}

export const ACCENTS: Accent[] = ["indigo", "blue", "teal", "violet", "rose"];
export const TEXT_SIZES: TextSize[] = ["sm", "md", "lg", "xl"];
export const MAX_CUSTOM_HOURS = 3;
export const MAX_TEMPLATES = 20;
/** Keeps the synced settings document well under Firestore's size limit. */
export const MAX_TEMPLATE_TEXT = 4000;

export const DEFAULT_PREFS: Prefs = {
  name: "",
  accent: "indigo",
  textSize: "md",
  clock: "auto",
  weekStart: 0,
  tz: "",
  customHours: [],
  templates: [],
  updatedAt: 0,
};

const KEY = "meetspan.prefs";
/** The name typed last before settings existed (adminStore.ts wrote it here). */
const OLD_NAME_KEY = "meetspan.organizerName";
/** Older browsers kept the timezone list here; its first entry seeds `tz`. */
const RECENT_TZS_KEY = "meetspan.recentTzs";

/** Keep only known values, so a hand-edited or older copy can't break the page. */
export function cleanPrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Prefs, unknown>>;
  const hours = Array.isArray(r.customHours) ? r.customHours : [];
  const templates = Array.isArray(r.templates) ? r.templates : [];
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return {
    name: str(r.name, 80),
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
    templates: templates
      .filter((x): x is EmailTemplate => !!x && typeof (x as EmailTemplate).id === "string")
      // Room for an edited copy of each built-in category on top of the user's own.
      .slice(0, MAX_TEMPLATES + MEETING_TYPES.length)
      .map((x) => ({
        id: str(x.id, 40),
        ...(MEETING_TYPES.some((m) => m.value === x.builtin) ? { builtin: x.builtin } : {}),
        name: str(x.name, 60),
        subject: str(x.subject, 300),
        body: str(x.body, MAX_TEMPLATE_TEXT),
        optionsBody: str(x.optionsBody, MAX_TEMPLATE_TEXT),
      })),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
  };
}

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? cleanPrefs(JSON.parse(raw)) : null;
    // First visit since settings existed: keep the zone picked last.
    const recent = JSON.parse(localStorage.getItem(RECENT_TZS_KEY) ?? "[]");
    const base = saved ?? { ...DEFAULT_PREFS, tz: Array.isArray(recent) && typeof recent[0] === "string" ? recent[0] : "" };
    // …and the name typed last, from before the name was a setting.
    return base.name ? base : { ...base, name: (localStorage.getItem(OLD_NAME_KEY) ?? "").trim() };
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

// Settings changed in another tab (e.g. a template added in Settings while an
// email draft is open) show up here too.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      current = cleanPrefs(JSON.parse(e.newValue));
    } catch {
      return;
    }
    applyPrefs(current);
    listeners.forEach((fn) => fn(current, true));
  });
}
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
