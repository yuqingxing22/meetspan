import { DateTime } from "luxon";

/**
 * "Import from Google Calendar": read the viewer's busy times (free/busy only,
 * never event titles) and mark every poll slot that doesn't clash as free.
 *
 * The token comes from Google Identity Services, not Firebase sign-in, so
 * importing never changes which account owns someone's answers. The token is
 * kept in memory only and is never saved or sent anywhere but Google.
 */

const SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";
const GIS_SRC = "https://accounts.google.com/gsi/client";

// The OAuth web client ID is public (it only identifies the app). Same
// accidental "VITE_…=" prefix guard as the Firebase config.
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "")
  .replace(/^\s*VITE_[A-Z0-9_]*=\s*/, "")
  .trim();

export const isCalendarImportConfigured = CLIENT_ID.length > 0;

export interface Busy {
  start: number;
  end: number;
}

// ---- Pure helpers (tested) -------------------------------------------------

/**
 * Weekly polls are stored on a reference week that may be in the past, so
 * read the calendar for the next upcoming copy of that week instead.
 * Returns how many weeks to move the slots forward (0 for date polls).
 */
export function weeksAhead(slots: number[], weekly: boolean, nowMs: number): number {
  if (!weekly || slots.length === 0) return 0;
  // Move until the last slot of the copied week hasn't passed yet.
  const last = Math.max(...slots);
  return last >= nowMs ? 0 : Math.ceil((nowMs - last) / (7 * 86_400_000));
}

/** Shift a slot by whole weeks in `tz`, so 9:00 stays 9:00 across a DST change. */
export function shiftWeeks(ms: number, weeks: number, tz: string): number {
  return weeks === 0 ? ms : DateTime.fromMillis(ms, { zone: tz }).plus({ weeks }).toMillis();
}

/** Slots (original instants) whose [start, start + granularity) overlaps no busy block. */
export function freeSlots(
  slots: number[],
  granularityMin: number,
  busy: Busy[],
  weeks: number,
  tz: string
): Set<number> {
  const step = granularityMin * 60_000;
  const free = new Set<number>();
  for (const ms of slots) {
    const s = shiftWeeks(ms, weeks, tz);
    const e = s + step;
    if (!busy.some((b) => b.start < e && b.end > s)) free.add(ms);
  }
  return free;
}

// ---- Google ----------------------------------------------------------------

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type?: string; message?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoading = null;
      reject(new Error("Couldn't load Google sign-in."));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

let cached: { token: string; expires: number } | null = null;

/** A free/busy access token; opens Google's consent popup when needed. */
async function getToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) {
          reject(new Error(r.error || "No access"));
          return;
        }
        cached = { token: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => reject(Object.assign(new Error(e.message || "Cancelled"), { code: e.type })),
    });
    client.requestAccessToken();
  });
}

async function fetchBusy(token: string, timeMin: number, timeMax: number): Promise<Busy[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      items: [{ id: "primary" }],
    }),
  });
  if (res.status === 401) cached = null;
  if (!res.ok) throw new Error(`Google Calendar error ${res.status}`);
  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }>;
  };
  const cal = data.calendars?.primary;
  if (cal?.errors?.length) throw new Error("Google Calendar couldn't read this calendar.");
  return (cal?.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

export interface CalendarImport {
  free: Set<number>;
  /** Weeks the slots were moved forward to read the calendar (weekly polls). */
  weeks: number;
  /** Monday of the week that was read (weekly polls), as an ISO date. */
  weekOf?: string;
}

/** Read the viewer's calendar for a poll's slots and return the free ones. */
export async function importFromGoogleCalendar(
  slots: number[],
  granularityMin: number,
  tz: string,
  weekly: boolean
): Promise<CalendarImport> {
  if (slots.length === 0) return { free: new Set(), weeks: 0 };
  const weeks = weeksAhead(slots, weekly, Date.now());
  const shifted = slots.map((ms) => shiftWeeks(ms, weeks, tz));
  const timeMin = Math.min(...shifted);
  const timeMax = Math.max(...shifted) + granularityMin * 60_000;
  const token = await getToken();
  const busy = await fetchBusy(token, timeMin, timeMax);
  return {
    free: freeSlots(slots, granularityMin, busy, weeks, tz),
    weeks,
    weekOf: weekly ? DateTime.fromMillis(timeMin, { zone: tz }).startOf("week").toISODate()! : undefined,
  };
}
