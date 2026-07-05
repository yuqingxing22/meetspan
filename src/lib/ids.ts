import { customAlphabet } from "nanoid";

// Lowercase alphanumerics only — safe in URLs and easy to read/share.
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const pollIdGen = customAlphabet(ALPHABET, 10);
const tokenGen = customAlphabet(ALPHABET, 28);

export function newPollId(): string {
  return pollIdGen();
}

/** Secret organizer token — lives only in the organizer's link + localStorage. */
export function newAdminToken(): string {
  return tokenGen();
}

export function newParticipantId(): string {
  return customAlphabet(ALPHABET, 12)();
}

/** SHA-256 hex digest. Used to store only a hash of the admin token. */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
