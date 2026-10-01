import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigured, subscribeUser } from "../firebase";
import { loadSchedule, type WeeklySchedule } from "./schedule";

export interface MySchedule {
  /** Signed in with Google (anonymous visitors can't keep a schedule). */
  signedIn: boolean;
  uid: string | null;
  user: User | null;
  /** undefined while loading; null when the user hasn't set one up yet. */
  schedule: WeeklySchedule | null | undefined;
  setSchedule: (s: WeeklySchedule) => void;
}

/** The signed-in user's saved weekly schedule, if any. */
export function useMySchedule(): MySchedule {
  const [user, setUser] = useState<User | null>(null);
  const [schedule, setSchedule] = useState<WeeklySchedule | null | undefined>(undefined);

  useEffect(() => (isFirebaseConfigured ? subscribeUser(setUser) : undefined), []);

  const signedIn = !!user && !user.isAnonymous;
  const uid = signedIn ? user!.uid : null;

  useEffect(() => {
    if (!uid) {
      setSchedule(undefined);
      return;
    }
    let alive = true;
    loadSchedule(uid)
      .then((s) => alive && setSchedule(s))
      .catch((e) => {
        console.error("Couldn't load your schedule", e);
        if (alive) setSchedule(null);
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  return { signedIn, uid, user, schedule, setSchedule };
}
