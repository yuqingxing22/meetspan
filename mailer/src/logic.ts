export function isEmail(s: string): boolean {
  return s.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(s);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type FsValue = Record<string, unknown>;

/** Decode one Firestore REST value into a plain JS value. */
export function fromFs(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) {
    const vals = (v.arrayValue as { values?: FsValue[] }).values ?? [];
    return vals.map(fromFs);
  }
  if ("mapValue" in v) {
    return fromFsFields((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {});
  }
  return undefined;
}

export function fromFsFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromFs(v);
  return out;
}

export const RETENTION_MONTHS = 12;

/** Cutoff timestamp: anything with its last activity before this is stale. */
export function retentionCutoff(nowMs: number, months = RETENTION_MONTHS): number {
  const d = new Date(nowMs);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.getTime();
}

/**
 * A poll is inactive when nothing happened to it since the cutoff: it was created,
 * edited by the organizer, and last answered by a participant all before the cutoff.
 */
export function isInactive(
  cutoffMs: number,
  poll: { createdAt?: unknown; lastActivityAt?: unknown },
  participantUpdatedAts: unknown[]
): boolean {
  const times = [poll.createdAt, poll.lastActivityAt, ...participantUpdatedAts].filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x)
  );
  if (times.length === 0) return false; // no timestamps at all: never guess, keep it
  return Math.max(...times) < cutoffMs;
}

/** SHA-256 hex digest, same as the web app uses to store the organizer token hash. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
