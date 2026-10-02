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

/**
 * Email the organizer their own private organizer link. The server sends it only to
 * the signed-in Google account's email. Returns the address it was sent to.
 */
export async function emailOrganizerLink(pollId: string, token: string): Promise<string> {
  const res = await call("/organizer-link", { pollId, token });
  if (!res) throw new Error("Email sending isn't set up yet.");
  const data = (await res.json().catch(() => ({}))) as { to?: string; error?: string };
  if (!res.ok || !data.to) throw new Error(data.error ?? `Could not send (${res.status})`);
  return data.to;
}

/** Delete a poll with all its replies and emails. Proves ownership with the organizer token. */
export async function deletePoll(pollId: string, organizerToken: string | null): Promise<void> {
  const res = await call("/delete-poll", { pollId, token: organizerToken ?? "" });
  if (!res) throw new Error("Deleting isn't set up yet.");
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Could not delete (${res.status})`);
  }
}
