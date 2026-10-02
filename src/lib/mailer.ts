import { getIdToken } from "../firebase";
import { getLang } from "./i18n";

/**
 * Base URL of the MeetSpan mailer (a Cloudflare Worker that sends email through
 * Brevo). Optional: when it's not configured, the app simply doesn't send mail.
 */
const MAILER_URL = ((import.meta.env.VITE_MAILER_URL as string | undefined) ?? "")
  .trim()
  .replace(/\/+$/, "");

export const mailerEnabled = MAILER_URL !== "";

async function call(path: string, body: Record<string, unknown>): Promise<Response | null> {
  if (!mailerEnabled) return null;
  const token = await getIdToken(true);
  if (!token) return null;
  return fetch(`${MAILER_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...body, lang: getLang() }),
  });
}

/** One-time welcome email after connecting Google. Never throws: it's a courtesy. */
export async function sendWelcomeEmail(): Promise<void> {
  try {
    await call("/welcome", {});
  } catch (e) {
    console.warn("Welcome email skipped", e);
  }
}

/** After a participant saves: the mailer tells the organizer once everyone has replied. */
export async function notifyResponse(pollId: string): Promise<void> {
  try {
    await call("/notify", { pollId });
  } catch (e) {
    console.warn("Completion check skipped", e);
  }
}

/** Organizer emails the poll link to the given addresses. Returns how many were sent. */
export async function sendInvites(pollId: string, emails: string[]): Promise<number> {
  const res = await call("/invite", { pollId, emails });
  if (!res) throw new Error("Email sending isn't set up yet.");
  const data = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Could not send (${res.status})`);
  return data.sent ?? 0;
}
