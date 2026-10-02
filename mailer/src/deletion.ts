import { deleteDocPath, listDocNames } from "./google";

/** Remove a poll with its replies and collected emails. Used by the owner's delete button and the daily cleanup. */
export async function deletePollAndChildren(project: string, token: string, pollId: string): Promise<void> {
  for (const sub of ["participants", "emails"]) {
    // Pages of up to 300 documents; a few rounds covers any real poll.
    for (let round = 0; round < 20; round++) {
      const names = await listDocNames(project, token, `polls/${pollId}/${sub}`);
      if (names.length === 0) break;
      for (const name of names) await deleteDocPath(project, token, name);
    }
  }
  await deleteDocPath(project, token, `polls/${pollId}`);
}
