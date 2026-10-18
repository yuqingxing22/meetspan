import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { ZH } from "./zh";
import { getPrefs } from "./prefs";

/**
 * Tiny i18n: English text is the key, `ZH` maps it to Chinese, and anything
 * missing falls back to English. `{name}` placeholders are filled from `vars`.
 *
 * Dates follow the language too: every `DateTime#toFormat` pattern the app
 * uses has a Chinese counterpart below (e.g. "ccc, LLL d" → "M月d日 ccc",
 * 12-hour → 24-hour). Patterns not listed (iCalendar stamps, zone names,
 * the AM/PM probe) are left untouched.
 */
export type Lang = "en" | "zh";

const STORAGE_KEY = "meetspan.lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    /* private mode */
  }
  if (typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language)) return "zh";
  return "en";
}

let current: Lang = typeof window === "undefined" ? "en" : detect();
const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode */
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  listeners.forEach((fn) => fn(lang));
}

/** Translate `text` into the current language. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const tpl = current === "zh" ? ZH[text] ?? text : text;
  return vars ? tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")) : tpl;
}

/** "A and B", "A, B and C" — or "A和B", "A、B和C" in Chinese. */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  const head = names.slice(0, -1).join(current === "zh" ? "、" : ", ");
  return `${head}${current === "zh" ? "和" : " and "}${names[names.length - 1]}`;
}

/** Run `fn` with text and dates in `lang` (e.g. an email in another language). */
export function withLang<T>(lang: Lang, fn: () => T): T {
  const prev = current;
  current = lang;
  try {
    return fn();
  } finally {
    current = prev;
  }
}

/** Re-render on language change. */
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, set] = useState(current);
  useEffect(() => {
    listeners.add(set);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return [lang, setLang];
}

// ---- Dates -----------------------------------------------------------------

const ZH_FORMATS: Record<string, string> = {
  "h:mm a": "H:mm",
  "h:mm": "H:mm",
  "h a": "H:00",
  ccc: "ccc",
  cccc: "cccc",
  "ccc d": "d日 ccc",
  "LLL d": "M月d日",
  "LLL d, yyyy": "yyyy年M月d日",
  "ccc, LLL d, yyyy": "yyyy年M月d日 ccc",
  "LLLL yyyy": "yyyy年M月",
  LLL: "M月",
  yyyy: "yyyy年",
  "ccc, LLL d": "M月d日 ccc",
  "cccc, LLL d": "M月d日 cccc",
  "cccc, LLLL d": "M月d日 cccc",
  "ccc\nLLL d": "ccc\nM月d日",
  "h:mm a ccc": "ccc H:mm",
  "ccc, LLL d · h:mm a": "M月d日 ccc · H:mm",
  "ccc, LLL d, h:mm a": "M月d日 ccc H:mm",
};

// The Settings page can override the clock: 24-hour English, 12-hour Chinese.
const EN_24: Record<string, string> = {
  "h:mm a": "H:mm",
  "h:mm": "H:mm",
  "h a": "H:00",
  "h:mm a ccc": "ccc H:mm",
  "ccc, LLL d · h:mm a": "ccc, LLL d · H:mm",
  "ccc, LLL d, h:mm a": "ccc, LLL d, H:mm",
};
const ZH_12: Record<string, string> = {
  "h:mm a": "ah:mm",
  "h:mm": "h:mm",
  "h a": "ah点",
  "h:mm a ccc": "ccc ah:mm",
  "ccc, LLL d · h:mm a": "M月d日 ccc · ah:mm",
  "ccc, LLL d, h:mm a": "M月d日 ccc ah:mm",
};

/** True when times show on a 24-hour clock (the language's habit unless Settings says otherwise). */
export function uses24h(): boolean {
  const clock = getPrefs().clock;
  return clock === "auto" ? current === "zh" : clock === "24";
}

const toFormat = DateTime.prototype.toFormat;
DateTime.prototype.toFormat = function (this: DateTime, fmt: string, opts?: Parameters<typeof toFormat>[1]) {
  if (current === "zh") {
    const zh = (!uses24h() && ZH_12[fmt]) || ZH_FORMATS[fmt];
    return zh ? toFormat.call(this.setLocale("zh-CN"), zh, opts) : toFormat.call(this, fmt, opts);
  }
  const en = uses24h() ? EN_24[fmt] : undefined;
  return toFormat.call(this, en ?? fmt, opts);
} as typeof toFormat;

if (typeof document !== "undefined") document.documentElement.lang = current === "zh" ? "zh-CN" : "en";
