import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import {
  isFirebaseConfigured,
  signInWithGoogle,
  signOutToAnonymous,
  subscribeUser,
} from "../firebase";
import { t } from "../lib/i18n";

/**
 * Topbar account control. Everyone starts anonymous (no sign-in needed); this
 * lets them optionally sign in with Google, or sign out again.
 */
export default function AccountMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => subscribeUser(setUser), []);

  if (!isFirebaseConfigured || !user) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      // Closing the popup is not an error worth shouting about.
      if (
        code !== "auth/popup-closed-by-user" &&
        code !== "auth/cancelled-popup-request"
      ) {
        setErr(code || t("Sign-in failed"));
      }
    } finally {
      setBusy(false);
    }
  };

  if (user.isAnonymous) {
    return (
      <div className="account">
        <Link to="/schedule" className="btn btn-sm" aria-label={t("My schedule")}>
          <Icon name="clock" />
          <span className="hide-narrow">{t("My schedule")}</span>
        </Link>
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          onClick={() => run(signInWithGoogle)}
          title={t("Optional: keep your polls across devices")}
          aria-label={t("Sign in with Google")}
        >
          <Icon name="user" />
          <span className="hide-narrow">{t("Sign in with Google")}</span>
        </button>
        {err && <span className="account-err">{err}</span>}
      </div>
    );
  }

  const name = user.displayName || user.email || t("Signed in");
  return (
    <div className="account">
      <Link to="/schedule" className="btn btn-sm" aria-label={t("My schedule")}>
        <Icon name="clock" />
        <span className="hide-narrow">{t("My schedule")}</span>
      </Link>
      {user.photoURL ? (
        <img
          className="account-photo"
          src={user.photoURL}
          alt=""
          width={28}
          height={28}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="avatar" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="account-name" title={user.email ?? undefined}>
        {name}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={() => run(signOutToAnonymous)}
      >
        {t("Sign out")}
      </button>
      {err && <span className="account-err">{err}</span>}
    </div>
  );
}
