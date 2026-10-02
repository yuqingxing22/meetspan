import { accessToken, getDoc, listDocs, setStringField, userEmail, verifyIdToken, type IdTokenClaims } from "./google";
import { expectedKey, isEmail, waitingOn } from "./logic";
import { cleanupInactivePolls } from "./cleanup";
import { allRespondedEmail, inviteEmail, welcomeEmail, type Lang, type Mail } from "./templates";

export interface Env {
  STATE: KVNamespace;
  BREVO_API_KEY: string;
  FIREBASE_SERVICE_ACCOUNT: string;
  FIREBASE_PROJECT_ID: string;
  SITE_URL: string;
  ALLOWED_ORIGINS: string;
  SENDER_EMAIL: string;
  REPLY_TO_EMAIL: string;
  /** "true" turns on real deletion in the daily cleanup; anything else is a dry run. */
  CLEANUP_ENABLED?: string;
}

const MAX_INVITES_PER_CALL = 10;
const MAX_INVITES_PER_DAY = 30;

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  return {
    "access-control-allow-origin": allowed.includes(origin) ? origin : allowed[0],
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "origin",
  };
}

function json(req: Request, env: Env, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors(req, env) },
  });
}

async function sendMail(env: Env, to: string, mail: Mail): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "MeetSpan", email: env.SENDER_EMAIL },
      replyTo: { name: "MeetSpan", email: env.REPLY_TO_EMAIL },
      to: [{ email: to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
    }),
  });
  if (!res.ok) throw new Error(`Brevo send failed (${res.status})`);
}

const asLang = (v: unknown): Lang => (v === "zh" ? "zh" : "en");

async function authed(req: Request, env: Env): Promise<IdTokenClaims | null> {
  const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  return m ? verifyIdToken(m[1], env.FIREBASE_PROJECT_ID) : null;
}

const isGoogle = (c: IdTokenClaims) => c.firebase?.sign_in_provider === "google.com" && !!c.email && c.email_verified !== false;

/** One-time welcome email, the first time an account connects Google. */
async function welcome(req: Request, env: Env, claims: IdTokenClaims, body: { lang?: string }) {
  if (!isGoogle(claims)) return json(req, env, 403, { error: "google account required" });
  const key = `welcome:${claims.sub}`;
  if (await env.STATE.get(key)) return json(req, env, 200, { sent: false, reason: "already welcomed" });
  await env.STATE.put(key, String(Date.now()));
  try {
    await sendMail(env, claims.email!, welcomeEmail(asLang(body.lang), env.SITE_URL, claims.name));
  } catch (e) {
    await env.STATE.delete(key); // let a later sign-in retry
    throw e;
  }
  return json(req, env, 200, { sent: true });
}

/** Organizer emails the poll link to people they name. Capped to stop abuse. */
async function invite(
  req: Request,
  env: Env,
  claims: IdTokenClaims,
  body: { pollId?: string; emails?: string[]; lang?: string }
) {
  if (!isGoogle(claims)) return json(req, env, 403, { error: "google account required" });
  const pollId = String(body.pollId ?? "");
  const emails = [...new Set((body.emails ?? []).map((e) => String(e).trim().toLowerCase()))].filter(isEmail);
  if (!pollId || emails.length === 0) return json(req, env, 400, { error: "pollId and emails required" });
  if (emails.length > MAX_INVITES_PER_CALL) return json(req, env, 400, { error: `max ${MAX_INVITES_PER_CALL} emails at a time` });

  const token = await accessToken(env.FIREBASE_SERVICE_ACCOUNT);
  const poll = await getDoc(env.FIREBASE_PROJECT_ID, token, `polls/${pollId}`);
  if (!poll || poll.organizerUid !== claims.sub) return json(req, env, 403, { error: "not the organizer" });

  const day = new Date().toISOString().slice(0, 10);
  const quotaKey = `invites:${claims.sub}:${day}`;
  const used = Number((await env.STATE.get(quotaKey)) ?? 0);
  if (used + emails.length > MAX_INVITES_PER_DAY) {
    return json(req, env, 429, { error: "daily invite limit reached", remaining: Math.max(0, MAX_INVITES_PER_DAY - used) });
  }
  await env.STATE.put(quotaKey, String(used + emails.length), { expirationTtl: 172800 });

  const mail = inviteEmail(asLang(body.lang ?? poll.lang), {
    organizerName: String(poll.organizerName ?? ""),
    title: String(poll.title ?? ""),
    url: `${env.SITE_URL}/#/p/${encodeURIComponent(pollId)}`,
    deadline: typeof poll.deadline === "string" ? poll.deadline : undefined,
  });
  let sent = 0;
  for (const to of emails) {
    try {
      await sendMail(env, to, mail);
      sent++;
    } catch (e) {
      console.error("invite failed", e);
    }
  }
  return json(req, env, 200, { sent, requested: emails.length });
}

/** Called after a participant saves: tell the organizer once everyone expected has replied. */
async function notify(req: Request, env: Env, body: { pollId?: string }) {
  const pollId = String(body.pollId ?? "");
  if (!pollId) return json(req, env, 400, { error: "pollId required" });
  const project = env.FIREBASE_PROJECT_ID;
  const token = await accessToken(env.FIREBASE_SERVICE_ACCOUNT);
  const poll = await getDoc(project, token, `polls/${pollId}`);
  if (!poll || poll.status !== "open") return json(req, env, 200, { sent: false, reason: "poll not open" });

  const expected = Array.isArray(poll.expected) ? (poll.expected as string[]) : [];
  if (expected.length === 0) return json(req, env, 200, { sent: false, reason: "no expected list" });

  const parts = await listDocs(project, token, `polls/${pollId}/participants`);
  if (waitingOn(expected, parts.map((p) => String(p.codename ?? ""))).length > 0) {
    return json(req, env, 200, { sent: false, reason: "still waiting" });
  }

  const key = expectedKey(expected);
  if (poll.completeNotifiedKey === key) return json(req, env, 200, { sent: false, reason: "already notified" });
  const lock = `complete:${pollId}:${key}`;
  if (await env.STATE.get(lock)) return json(req, env, 200, { sent: false, reason: "already notified" });
  await env.STATE.put(lock, "1", { expirationTtl: 60 * 60 * 24 * 30 });

  const to = await userEmail(project, token, String(poll.organizerUid ?? ""));
  if (!to) return json(req, env, 200, { sent: false, reason: "organizer has no email" });

  await sendMail(
    env,
    to,
    allRespondedEmail(asLang(poll.lang), {
      title: String(poll.title ?? ""),
      count: expected.length,
      url: `${env.SITE_URL}/#/o/${encodeURIComponent(pollId)}`,
    })
  );
  await setStringField(project, token, `polls/${pollId}`, "completeNotifiedKey", key);
  return json(req, env, 200, { sent: true });
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await cleanupInactivePolls(env);
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req, env) });
    if (req.method !== "POST") return json(req, env, 405, { error: "POST only" });
    const origin = req.headers.get("origin") ?? "";
    if (!env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).includes(origin)) {
      return json(req, env, 403, { error: "origin not allowed" });
    }
    const claims = await authed(req, env);
    if (!claims) return json(req, env, 401, { error: "sign-in required" });

    const path = new URL(req.url).pathname;
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, never>;
      if (path === "/welcome") return await welcome(req, env, claims, body);
      if (path === "/invite") return await invite(req, env, claims, body);
      if (path === "/notify") return await notify(req, env, body);
      return json(req, env, 404, { error: "not found" });
    } catch (e) {
      console.error(e);
      return json(req, env, 500, { error: "could not send" });
    }
  },
};
