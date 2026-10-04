// Sends errors that happen in visitors' browsers to the MeetSpan mailer, which
// keeps them for two weeks and emails the owner a daily summary. Nothing
// personal is sent: no names, emails, poll ids or organizer keys.

const MAILER_URL = ((import.meta.env.VITE_MAILER_URL as string | undefined) ?? "").trim().replace(/\/+$/, "");
const MAX_PER_VISIT = 5;
const sent = new Set<string>();

/** "#/o/:id" from "#/o/k7q2m9?k=…": the page, without ids or keys. */
export function pagePath(hash: string): string {
  return (hash || "#/").replace(/\?.*$/, "").replace(/(#\/[op]\/)[^/]+/, "$1:id");
}

/** Noise we can't act on: browser extensions, cross-origin "Script error.", resize loops. */
export function isNoise(message: string, stack: string): boolean {
  if (/ResizeObserver loop/i.test(message)) return true;
  if (/^Script error\.?$/i.test(message) && !stack) return true;
  return /(chrome|moz|safari(-web)?)-extension:\/\//i.test(stack);
}

function buildId(): string {
  const src = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/"]')?.src ?? "";
  return src.split("/").pop()?.replace(/\.js$/, "") ?? "";
}

function browserName(): string {
  const ua = navigator.userAgent;
  const m =
    ua.match(/(Edg|OPR|Firefox|CriOS|FxiOS|Chrome|Version)\/(\d+)/) ?? [];
  const name = { Edg: "Edge", OPR: "Opera", CriOS: "Chrome iOS", FxiOS: "Firefox iOS", Version: "Safari" }[m[1] as string] ?? m[1] ?? "?";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : "other";
  return `${name} ${m[2] ?? ""} · ${os}`.trim();
}

/** Report an error once per visit. Never throws. */
export function reportError(err: unknown): void {
  try {
    if (!MAILER_URL || sent.size >= MAX_PER_VISIT) return;
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
    const message = `${e.name && !e.message.startsWith(e.name) ? `${e.name}: ` : ""}${e.message}`.slice(0, 500);
    const stack = (e.stack ?? "").slice(0, 3000);
    if (isNoise(message, stack) || sent.has(message)) return;
    sent.add(message);
    void fetch(`${MAILER_URL}/report`, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, stack, path: pagePath(location.hash), browser: browserName(), build: buildId() }),
    }).catch(() => {});
  } catch {
    /* reporting must never break the page */
  }
}

/** Catch errors nothing else handled. */
export function installErrorReporting(): void {
  window.addEventListener("error", (ev) => reportError(ev.error ?? ev.message));
  window.addEventListener("unhandledrejection", (ev) => reportError(ev.reason));
}
