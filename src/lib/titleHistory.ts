// Meeting names this browser has used before, offered as suggestions when
// creating a new poll. Kept on this device only, capped by count and age.

const TITLES_KEY = "meetspan.recentTitles";

/** Keep at most this many names… */
export const MAX_TITLES = 8;
/** …and forget a name that hasn't been used for this many days. */
export const MAX_AGE_DAYS = 90;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export interface RecentTitle {
  title: string;
  usedAt: number;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Drop expired entries, newest first, at most MAX_TITLES. */
export function pruneTitles(list: RecentTitle[], now: number): RecentTitle[] {
  return list
    .filter((x) => x && typeof x.title === "string" && x.title.trim() && now - x.usedAt < MAX_AGE_MS)
    .sort((a, b) => b.usedAt - a.usedAt)
    .slice(0, MAX_TITLES);
}

/** Put `title` at the top (replacing an existing copy, ignoring case). */
export function withTitle(list: RecentTitle[], title: string, now: number): RecentTitle[] {
  const clean = title.trim();
  if (!clean) return pruneTitles(list, now);
  return pruneTitles([{ title: clean, usedAt: now }, ...list.filter((x) => !same(x.title, clean))], now);
}

function read(): RecentTitle[] {
  try {
    const raw = localStorage.getItem(TITLES_KEY);
    const list = raw ? (JSON.parse(raw) as RecentTitle[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: RecentTitle[]): void {
  try {
    localStorage.setItem(TITLES_KEY, JSON.stringify(list));
  } catch {
    /* ignore private-mode failures */
  }
}

export function listRecentTitles(now = Date.now()): RecentTitle[] {
  return pruneTitles(read(), now);
}

export function rememberTitle(title: string, now = Date.now()): void {
  write(withTitle(read(), title, now));
}

export function forgetTitle(title: string, now = Date.now()): RecentTitle[] {
  const list = pruneTitles(read().filter((x) => !same(x.title, title)), now);
  write(list);
  return list;
}

