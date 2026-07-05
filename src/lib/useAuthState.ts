import { useEffect, useState } from "react";
import {
  authReady,
  currentUid,
  isFirebaseConfigured,
  subscribeAuth,
} from "../firebase";

export type AuthState = "loading" | "error" | string; // string = signed-in uid

/**
 * Track anonymous auth: "loading" while signing in, "error" if sign-in failed
 * (e.g. Anonymous Auth not enabled), or the uid once signed in. Firestore rules
 * require auth, so pages gate their reads/writes on a string result.
 */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(() =>
    !isFirebaseConfigured ? "error" : currentUid() ?? "loading"
  );

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let alive = true;
    authReady.then((uid) => {
      if (alive) setState(uid ?? "error");
    });
    // Keep in sync if the uid changes later (e.g. token refresh restores it).
    const unsub = subscribeAuth((uid) => {
      if (alive && uid) setState(uid);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return state;
}
