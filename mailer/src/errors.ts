// Error reports from visitors' browsers: stored in KV for two weeks, and
// summarized in one email a day (only on days with errors).

import { escapeHtml, sha256Hex } from "./logic";
import type { Mail } from "./templates";

/**
 * KV on the free plan allows 1,000 writes a day, shared with the email counters.
 * Each report costs two writes, so cap them well below that.
 */
export const MAX_REPORTS_PER_DAY = 150;
const KEEP_SECONDS = 14 * 24 * 60 * 60;

export interface ErrorReport {
  message: string;
  stack: string;
  path: string;
  browser: string;
  build: string;
}

export interface StoredError extends ErrorReport {
  count: number;
  first: string;
  last: string;
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

/**
 * Remove anything that could identify a person or unlock a poll: organizer keys
 * (k=…), email addresses and long id-like strings in links.
 */
export function scrub(text: string): string {
  return text
    .replace(/([?&#]k=)[^&\s#"')]+/gi, "$1[removed]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(#\/[op]\/)[A-Za-z0-9_-]+/g, "$1:id");
}

/** Validate and clean a report from the browser; null when it's not one. */
export function cleanReport(body: Record<string, unknown>): ErrorReport | null {
  const message = scrub(clip(body.message, 500)).trim();
  if (!message) return null;
  return {
    message,
    stack: scrub(clip(body.stack, 3000)),
    path: scrub(clip(body.path, 200)),
    browser: clip(body.browser, 120),
    build: clip(body.build, 40),
  };
}

/** Same error (message + first stack line) on the same day shares one record. */
export async function errorKey(day: string, r: ErrorReport): Promise<string> {
  const firstFrame = r.stack.split("\n").find((l) => l.includes(":")) ?? "";
  return `err:${day}:${(await sha256Hex(`${r.message}\n${firstFrame}`)).slice(0, 16)}`;
}

/** Store a report. Returns false when today's cap is used up. */
export async function storeReport(kv: KVNamespace, r: ErrorReport, now = new Date()): Promise<boolean> {
  const day = now.toISOString().slice(0, 10);
  const totalKey = `errtotal:${day}`;
  const total = Number((await kv.get(totalKey)) ?? 0);
  if (total >= MAX_REPORTS_PER_DAY) return false;
  const key = await errorKey(day, r);
  const prev = (await kv.get(key, "json")) as StoredError | null;
  const stamp = now.toISOString();
  const next: StoredError = prev
    ? { ...prev, count: prev.count + 1, last: stamp }
    : { ...r, count: 1, first: stamp, last: stamp };
  await kv.put(key, JSON.stringify(next), { expirationTtl: KEEP_SECONDS });
  await kv.put(totalKey, String(total + 1), { expirationTtl: KEEP_SECONDS });
  return true;
}

/** Everything stored for one UTC day, most frequent first. */
export async function errorsForDay(kv: KVNamespace, day: string): Promise<StoredError[]> {
  const out: StoredError[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: `err:${day}:`, cursor });
    for (const k of page.keys) {
      const v = (await kv.get(k.name, "json")) as StoredError | null;
      if (v) out.push(v);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out.sort((a, b) => b.count - a.count);
}

/** The daily summary email (English, for the site owner). */
export function digestEmail(day: string, errors: StoredError[], capped: boolean): Mail {
  const total = errors.reduce((n, e) => n + e.count, 0);
  const shown = errors.slice(0, 20);
  const subject = `MeetSpan: ${errors.length} error${errors.length === 1 ? "" : "s"} on ${day} (${total} report${total === 1 ? "" : "s"})`;
  const textParts = shown.map(
    (e, i) =>
      `${i + 1}. ${e.message}\n   ${e.count}× · page ${e.path || "?"} · ${e.browser || "?"} · build ${e.build || "?"}\n   first ${e.first} · last ${e.last}\n   ${e.stack.split("\n").slice(0, 5).join("\n   ")}`
  );
  const note = capped ? `\n\nToday's report limit (${MAX_REPORTS_PER_DAY}) was reached, so some reports were dropped.` : "";
  const more = errors.length > shown.length ? `\n\n…and ${errors.length - shown.length} more.` : "";
  const text = `Errors visitors hit on ${day} (UTC).\n\n${textParts.join("\n\n")}${more}${note}\n\nDetails stay in Cloudflare KV for two weeks (keys err:${day}:…).`;
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;color:#14151a">
  <p>Errors visitors hit on <b>${day}</b> (UTC): ${errors.length} distinct, ${total} in total.</p>
  ${shown
    .map(
      (e) => `<div style="border:1px solid #e6e7ec;border-radius:10px;padding:12px 14px;margin:0 0 10px">
    <div style="font-weight:600">${escapeHtml(e.message)}</div>
    <div style="color:#5b5f6b;margin-top:4px">${e.count}× · page ${escapeHtml(e.path || "?")} · ${escapeHtml(e.browser || "?")} · build ${escapeHtml(e.build || "?")}</div>
    <pre style="font-size:12px;white-space:pre-wrap;color:#3d4049;margin:8px 0 0">${escapeHtml(e.stack.split("\n").slice(0, 5).join("\n"))}</pre>
  </div>`
    )
    .join("")}
  ${more ? `<p>${escapeHtml(more.trim())}</p>` : ""}${note ? `<p>${escapeHtml(note.trim())}</p>` : ""}
</div>`;
  return { subject, html, text };
}
