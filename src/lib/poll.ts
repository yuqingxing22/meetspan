import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { hashToken } from "./ids";
import type {
  Finalized,
  Participant,
  ParticipantEmail,
  PollMeta,
} from "./types";

function pollRef(pollId: string) {
  return doc(db(), "polls", pollId);
}
function participantsRef(pollId: string) {
  return collection(db(), "polls", pollId, "participants");
}
function emailsRef(pollId: string) {
  return collection(db(), "polls", pollId, "emails");
}

export async function createPoll(pollId: string, meta: PollMeta): Promise<void> {
  await setDoc(pollRef(pollId), meta);
}

export async function getPoll(pollId: string): Promise<PollMeta | null> {
  const snap = await getDoc(pollRef(pollId));
  return snap.exists() ? (snap.data() as PollMeta) : null;
}

/** Live subscription to the poll document. Returns an unsubscribe fn. */
export function subscribePoll(
  pollId: string,
  cb: (meta: PollMeta | null) => void
): () => void {
  return onSnapshot(pollRef(pollId), (snap) => {
    cb(snap.exists() ? (snap.data() as PollMeta) : null);
  });
}

/** Live subscription to all participants. Returns an unsubscribe fn. */
export function subscribeParticipants(
  pollId: string,
  cb: (list: Participant[]) => void
): () => void {
  return onSnapshot(participantsRef(pollId), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Participant, "id">) }));
    list.sort((a, b) => a.updatedAt - b.updatedAt);
    cb(list);
  });
}

export async function upsertParticipant(
  pollId: string,
  participant: Participant
): Promise<void> {
  const { id, ...data } = participant;
  await setDoc(doc(participantsRef(pollId), id), data);
}

/**
 * Store (or clear) a participant's email in the organizer-only `emails`
 * collection, keyed by the writer's uid so only they can edit it. A blank/empty
 * email removes the doc.
 */
export async function setParticipantEmail(
  pollId: string,
  uid: string,
  email: string,
  codename: string
): Promise<void> {
  const ref = doc(emailsRef(pollId), uid);
  const trimmed = email.trim();
  if (trimmed.includes("@")) {
    await setDoc(ref, { email: trimmed, codename });
  } else {
    // No usable address — remove any previously stored one.
    await deleteDoc(ref).catch(() => {});
  }
}

/**
 * Live subscription to collected emails. Only the organizer's uid can read
 * these (per Firestore rules); for anyone else the listener errors and we
 * simply report an empty list.
 */
export function subscribeEmails(
  pollId: string,
  cb: (list: ParticipantEmail[]) => void
): () => void {
  return onSnapshot(
    emailsRef(pollId),
    (snap) => {
      const list = snap.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as Omit<ParticipantEmail, "uid">),
      }));
      cb(list);
    },
    () => cb([]) // permission-denied for non-organizers → no recipients
  );
}

export async function closePoll(pollId: string): Promise<void> {
  await updateDoc(pollRef(pollId), { status: "closed" });
}

export async function reopenPoll(pollId: string): Promise<void> {
  await updateDoc(pollRef(pollId), { status: "open" });
}

export async function finalizePoll(
  pollId: string,
  finalized: Finalized
): Promise<void> {
  await updateDoc(pollRef(pollId), { finalized });
}

/** Verify a plaintext admin token against the stored hash. */
export async function verifyAdmin(
  meta: PollMeta,
  token: string | null
): Promise<boolean> {
  if (!token) return false;
  const h = await hashToken(token);
  return h === meta.adminTokenHash;
}
