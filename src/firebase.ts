import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
} from "firebase/auth";

// The Firebase *web* config is public by design — it only identifies your
// project. Real security is enforced by Firestore rules + Anonymous Auth
// (see README.md). Values come from Vite env vars (.env locally, repo
// Variables in CI).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
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

/** Subscribe to auth changes. Fires with the uid (or null when signed out). */
export function subscribeAuth(cb: (uid: string | null) => void): () => void {
  if (!authInstance) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(authInstance, (u) => cb(u?.uid ?? null));
}
