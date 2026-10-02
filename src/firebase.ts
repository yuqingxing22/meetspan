import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  linkWithPopup,
  signOut,
  GoogleAuthProvider,
  type Auth,
  type User,
} from "firebase/auth";
import { sendWelcomeEmail } from "./lib/mailer";

// The Firebase *web* config is public by design — it only identifies your
// project. Real security is enforced by Firestore rules + Anonymous Auth
// (see README.md). Values come from Vite env vars (.env locally, repo
// Variables in CI).
//
// Be forgiving about how the env values were entered: a common mistake when
// setting the GitHub Actions *Variables* is to paste the whole `NAME=value`
// line (or leave a trailing newline) into the value box. That would ship an
// apiKey like "VITE_FIREBASE_API_KEY=AIza…" and Firebase rejects it with
// `auth/api-key-not-valid`. Strip any accidental `VITE_…=` prefix and
// surrounding whitespace so the app works regardless.
const clean = (v: string | undefined): string =>
  (v ?? "").replace(/^\s*VITE_[A-Z0-9_]*=\s*/, "").trim();

const firebaseConfig = {
  apiKey: clean(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: clean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(import.meta.env.VITE_FIREBASE_APP_ID),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app: FirebaseApp | undefined;
let dbInstance: Firestore | undefined;
let authInstance: Auth | undefined;

/**
 * Resolves to the signed-in anonymous uid, or null if sign-in failed (usually
 * because Anonymous Auth isn't enabled in the Firebase console). Firestore
 * rules require an authenticated user, so callers must await this before
 * reading/writing.
 */
export let authReady: Promise<string | null> = Promise.resolve(null);

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  dbInstance = getFirestore(app);
  authInstance = getAuth(app);
  authReady = signInAnonymously(authInstance)
    .then((cred) => cred.user.uid)
    .catch((e) => {
      console.error("Anonymous sign-in failed — is Anonymous Auth enabled?", e);
      return null;
    });
}

/** Firestore handle. Throws a friendly error if config is missing. */
export function db(): Firestore {
  if (!dbInstance) {
    throw new Error(
      "Firebase is not configured. Add your web config to .env (see README.md)."
    );
  }
  return dbInstance;
}

/** The current anonymous uid, or null if not signed in yet. */
export function currentUid(): string | null {
  return authInstance?.currentUser?.uid ?? null;
}

/** A fresh Firebase ID token for the current user (sent to the mailer), or null. */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  return (await authInstance?.currentUser?.getIdToken(forceRefresh)) ?? null;
}

/** Subscribe to auth changes. Fires with the uid (or null when signed out). */
export function subscribeAuth(cb: (uid: string | null) => void): () => void {
  if (!authInstance) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(authInstance, (u) => cb(u?.uid ?? null));
}

/** Current Firebase user (anonymous or Google), or null. */
export function currentUser(): User | null {
  return authInstance?.currentUser ?? null;
}

/** Subscribe to the full user object (to show name / photo / anonymous state). */
export function subscribeUser(cb: (u: User | null) => void): () => void {
  if (!authInstance) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(authInstance, cb);
}

/**
 * Optional Google sign-in. If the visitor is currently anonymous, the Google
 * account is *linked* to the same uid, so polls they already created stay
 * theirs. If that Google account was already used before (on another device),
 * switch to it instead, which brings back that account's polls.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!authInstance) throw new Error("Firebase is not configured.");
  const provider = new GoogleAuthProvider();
  const user = authInstance.currentUser;
  if (user?.isAnonymous) {
    try {
      await linkWithPopup(user, provider);
      void sendWelcomeEmail();
      return;
    } catch (e) {
      const code = (e as { code?: string }).code;
      const cred = GoogleAuthProvider.credentialFromError(e as never);
      if (code === "auth/credential-already-in-use" && cred) {
        await signInWithCredential(authInstance, cred);
        void sendWelcomeEmail();
        return;
      }
      throw e;
    }
  }
  await signInWithPopup(authInstance, provider);
  void sendWelcomeEmail();
}

/** Sign out, then drop back to a fresh anonymous session so the app keeps working. */
export async function signOutToAnonymous(): Promise<void> {
  if (!authInstance) return;
  await signOut(authInstance);
  await signInAnonymously(authInstance);
}
