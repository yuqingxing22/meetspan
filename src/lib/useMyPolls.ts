import { useCallback, useEffect, useMemo, useState } from "react";
import { MYPOLLS_EVENT, listMyPolls, removeMyPoll, type MyPoll } from "./adminStore";
import { closePoll, getPoll, listPollsByOrganizer } from "./poll";
import { deletePoll } from "./mailer";
import { isFirebaseConfigured } from "../firebase";
import { useAuthState } from "./useAuthState";

export interface MyPollEntry extends MyPoll {
  /** Unknown until the poll has been read. */
  status?: "open" | "closed";
}

/**
 * Polls created in this browser (which carry the admin token) merged with
 * polls tied to this account on the server (any device where the same Google
 * account is signed in), newest first, with each poll's open/closed status.
 */
export function useMyPolls(): { polls: MyPollEntry[]; refresh: () => void } {
  const auth = useAuthState();
  const uid = typeof auth === "string" && auth !== "loading" && auth !== "error" ? auth : null;
  const [local, setLocal] = useState<MyPoll[]>(() => listMyPolls());
  const [cloud, setCloud] = useState<MyPollEntry[]>([]);
  const [status, setStatus] = useState<Record<string, "open" | "closed">>({});
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const onChange = () => setLocal(listMyPolls());
    window.addEventListener(MYPOLLS_EVENT, onChange);
    return () => window.removeEventListener(MYPOLLS_EVENT, onChange);
  }, []);

  useEffect(() => {
    setLocal(listMyPolls());
    if (!isFirebaseConfigured || !uid) return;
    let alive = true;
    listPollsByOrganizer(uid)
      .then((list) => {
        if (!alive) return;
        setCloud(
          list.map(({ pollId, meta }) => ({
            pollId,
            token: "",
            title: meta.title,
            createdAt: meta.createdAt,
            status: meta.status,
          }))
        );
      })
      .catch((e) => console.error("Couldn't load your polls", e));
    return () => {
      alive = false;
    };
  }, [uid, tick]);

  // Read the status of polls that only this browser knows about. A poll
  // deleted elsewhere is dropped from the list.
  useEffect(() => {
    if (!isFirebaseConfigured || !uid) return;
    let alive = true;
    const cloudIds = new Set(cloud.map((p) => p.pollId));
    for (const p of local) {
      if (cloudIds.has(p.pollId)) continue;
      getPoll(p.pollId)
        .then((meta) => {
          if (!alive) return;
          if (meta === null) removeMyPoll(p.pollId);
          else setStatus((s) => ({ ...s, [p.pollId]: meta.status }));
        })
        .catch(() => {
          /* offline: show it without a status */
        });
    }
    return () => {
      alive = false;
    };
  }, [uid, local, cloud, tick]);

  const polls = useMemo(() => {
    const byId = new Map<string, MyPollEntry>();
    cloud.forEach((p) => byId.set(p.pollId, p));
    local.forEach((p) =>
      byId.set(p.pollId, { ...p, status: byId.get(p.pollId)?.status ?? status[p.pollId] })
    );
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  }, [cloud, local, status]);

  return { polls, refresh };
}

export interface BatchResult {
  done: number;
  failed: number;
}

async function each(polls: MyPollEntry[], fn: (p: MyPollEntry) => Promise<void>): Promise<BatchResult> {
  const results = await Promise.allSettled(polls.map(fn));
  results.forEach((r) => r.status === "rejected" && console.error(r.reason));
  const failed = results.filter((r) => r.status === "rejected").length;
  return { done: results.length - failed, failed };
}

/** Close several polls (they stop taking answers; they can be reopened). */
export function closePolls(polls: MyPollEntry[]): Promise<BatchResult> {
  return each(polls, (p) => closePoll(p.pollId));
}

/** Delete several polls with their replies and emails, and forget them here. */
export function deletePolls(polls: MyPollEntry[]): Promise<BatchResult> {
  return each(polls, async (p) => {
    await deletePoll(p.pollId, p.token || null);
    removeMyPoll(p.pollId);
  });
}
