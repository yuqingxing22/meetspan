import { useEffect, useReducer, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigured, subscribeUserChanges } from "../firebase";
import { firstName } from "./adminStore";

/**
 * The current Firebase user, re-rendering also when it changes in place
 * (anonymous → Google keeps the same object, so plain state wouldn't notice).
 */
export function useUser(): User | null {
  const [user, setUser] = useState<User | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return subscribeUserChanges((u) => {
      setUser(u);
      bump();
    });
  }, []);
  return user;
}

/** First name of a Google-signed-in user, or "" (anonymous / no name). */
export function googleFirstName(user: User | null): string {
  if (!user || user.isAnonymous) return "";
  const google = user.providerData.find((p) => p.providerId === "google.com");
  return firstName(user.displayName || google?.displayName);
}
