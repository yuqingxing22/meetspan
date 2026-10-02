import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import Icon from "./Icon";
import { signInWithGoogle, subscribeUser } from "../firebase";
import { mailerEnabled, sendInvites } from "../lib/mailer";
import { parseEmails } from "../lib/inviteEmails";
import { t } from "../lib/i18n";

const MAX_AT_ONCE = 5;
function friendly(msg: string): string {
  if (/invites paused/i.test(msg)) return t("Invites are paused for today. Please try again tomorrow.");
  if (/poll invite limit/i.test(msg)) return t("This poll has reached its invite limit.");
  if (/daily invite limit/i.test(msg)) return t("You've reached today's invite limit. Try again tomorrow.");
  if (/not the organizer/i.test(msg)) return t("Only the organizer's account can send invites for this poll.");
  if (/google account required/i.test(msg)) return t("Sign in with Google to send invites by email.");
  return t("Couldn't send the invites. Please try again.");
}

/**
 * Lets the organizer have MeetSpan email the invite link to people. Needs a
 * Google sign-in (so it can't be used anonymously to send spam) and the mailer.
 */
export default function InviteByEmail({ pollId }: { pollId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => subscribeUser(setUser), []);
  if (!mailerEnabled) return null;

  const { good, bad } = parseEmails(text);

  async function send() {
    if (bad.length) {
      setNote({ ok: false, msg: t("Please check these addresses: {list}", { list: bad.join(", ") }) });
      return;
    }
    if (good.length === 0) return;
    if (good.length > MAX_AT_ONCE) {
      setNote({ ok: false, msg: t("Up to {n} addresses at a time.", { n: MAX_AT_ONCE }) });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const sent = await sendInvites(pollId, good);
      setNote({ ok: sent > 0, msg: t("Invites sent to {n} people.", { n: sent }) });
      if (sent > 0) setText("");
    } catch (e) {
      setNote({ ok: false, msg: friendly((e as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="invite-email">
        <p className="hint">{t("Sign in with Google to send invites by email. This keeps the feature from being used for spam.")}</p>
        <button type="button" className="btn" onClick={() => signInWithGoogle().catch(() => {})}>
          <Icon name="user" /> {t("Sign in with Google")}
        </button>
      </div>
    );
  }

  return (
    <div className="invite-email">
      <label className="field-label" htmlFor="invite-emails">
        {t("Email addresses, separated by commas or new lines")}
      </label>
      <textarea
        id="invite-emails"
        rows={3}
        value={text}
        placeholder="mei@example.com, alex@example.com"
        onChange={(e) => {
          setText(e.target.value);
          setNote(null);
        }}
      />
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy || good.length === 0} onClick={send}>
          <Icon name="mail" /> {busy ? t("Sending…") : t("Send invites")}
        </button>
        <span className="hint">{t("{n} of {max}", { n: good.length, max: MAX_AT_ONCE })}</span>
      </div>
      {note && (
        <p className={note.ok ? "hint invite-ok" : "hint invite-err"} role="status">
          {note.msg}
        </p>
      )}
    </div>
  );
}
