// Timezones this browser picked by hand, shown as "Recent" in the picker.

import { canonicalTz } from "./slots";

const KEY = "meetspan.recentTzs";
export const MAX_RECENT_TZS = 5;

/** Put `tz` first (replacing an existing copy of the same zone), at most MAX_RECENT_TZS. */
export function withRecentTz(list: string[], tz: string): string[] {
  const key = canonicalTz(tz);
  return [tz, ...list.filter((x) => canonicalTz(x) !== key)].slice(0, MAX_RECENT_TZS);
}

export function listRecentTzs(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberTz(tz: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(withRecentTz(listRecentTzs(), tz)));
  } catch {
    /* ignore private-mode failures */
  }
}
