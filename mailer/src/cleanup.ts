import { accessToken, deleteDocPath, listDocNames, listDocs, pollsCreatedBefore } from "./google";
import { isInactive, retentionCutoff } from "./logic";
import type { Env } from "./index";

const BATCH = 50;

/**
 * Daily job: remove polls with no activity for 12 months, together with their
 * replies and collected emails. Unless CLEANUP_ENABLED is exactly "true" it only
 * logs what it would delete.
 */
export async function cleanupInactivePolls(env: Env, nowMs = Date.now()): Promise<{ checked: number; stale: number; deleted: number }> {
  const project = env.FIREBASE_PROJECT_ID;
  const live = env.CLEANUP_ENABLED === "true";
  const token = await accessToken(env.FIREBASE_SERVICE_ACCOUNT);
  const cutoff = retentionCutoff(nowMs);
  const candidates = await pollsCreatedBefore(project, token, cutoff, BATCH);
  let stale = 0;
  let deleted = 0;
  for (const { id, data } of candidates) {
    const parts = await listDocs(project, token, `polls/${id}/participants`);
    if (!isInactive(cutoff, data, parts.map((p) => p.updatedAt))) continue;
    stale++;
    if (!live) {
      console.log(`[cleanup dry run] would delete poll ${id}`);
      continue;
    }
    for (const sub of ["participants", "emails"]) {
      for (const name of await listDocNames(project, token, `polls/${id}/${sub}`)) {
        await deleteDocPath(project, token, name);
      }
    }
    await deleteDocPath(project, token, `polls/${id}`);
    deleted++;
  }
  console.log(`[cleanup] checked ${candidates.length}, inactive ${stale}, deleted ${deleted} (${live ? "live" : "dry run"})`);
  return { checked: candidates.length, stale, deleted };
}
