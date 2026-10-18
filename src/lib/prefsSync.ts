import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured, subscribeUserChanges } from "../firebase";
import { cleanPrefs, getPrefs, setPrefs, subscribePrefs, type Prefs } from "./prefs";

/**
 * Copy settings to the signed-in Google account (prefs/{uid}, private to its
 * owner), so a new device starts with the same theme, timezone and recent
 * hours. Anonymous visitors keep them in the browser only. Failures are
 * logged and otherwise ignored: the browser copy still works.
 */
export function startPrefsSync(): () => void {
  if (!isFirebaseConfigured) return () => {};
  let uid: string | null = null;
  let timer: number | undefined;

  const push = (p: Prefs) => {
    if (!uid) return;
    const target = uid;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      setDoc(doc(db(), "prefs", target), p).catch((e) => console.warn("Couldn't save settings to your account", e));
    }, 600);
  };

  // Fires on sign-in, and also when an anonymous visitor links Google (same uid).
  const offUser = subscribeUserChanges((u) => {
    const next = u && !u.isAnonymous ? u.uid : null;
    if (next === uid) return; // token refresh
    uid = next;
    if (!uid) return;
    const target = uid;
    getDoc(doc(db(), "prefs", target))
      .then((snap) => {
        if (uid !== target) return;
        const remote = snap.exists() ? cleanPrefs(snap.data()) : null;
        // The newer copy wins: the account's on a fresh device, this one after offline changes.
        if (remote && remote.updatedAt > getPrefs().updatedAt) setPrefs(remote, { fromAccount: true });
        else if (getPrefs().updatedAt > 0) push(getPrefs());
      })
      .catch((e) => console.warn("Couldn't load settings from your account", e));
  });

  const offPrefs = subscribePrefs((p, fromAccount) => {
    if (!fromAccount) push(p);
  });

  return () => {
    offUser();
    offPrefs();
    window.clearTimeout(timer);
  };
}
