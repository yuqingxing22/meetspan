import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigured, subscribeUser } from "../firebase";
import { loadSchedule, type WeeklySchedule } from "./schedule";

export interface MySchedule {
  /** Signed in with Google (the schedule then follows them to other devices). */
  signedIn: boolean;
  /** Anyone with a session, anonymous or Google: the key their schedule is saved under. */
  uid: string | null;
  user: User | null;
  /** undefined while loading; null when the user hasn't set one up yet. */
  schedule: WeeklySchedule | null | undefined;
  setSchedule: (s: WeeklySchedule) => void;
}

/** The visitor's saved weekly schedule, if any. Anonymous visitors keep one too (per browser). */
export function useMySchedule(): MySchedule {
  const [user, setUser] = useState<User | null>(null);
  const [schedule, setSchedule] = useState<WeeklySchedule | null | undefined>(undefined);

  useEffect(() => (isFirebaseConfigured ? subscribeUser(setUser) : undefined), []);

  const signedIn = !!user && !user.isAnonymous;
  const uid = user?.uid ?? null;

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
