// Small localStorage helpers so a returning organizer keeps control of their
// poll, and a returning participant keeps their identity/selections.

const ADMIN_PREFIX = "meetspan.admin.";
const PART_PREFIX = "meetspan.participant.";
const MYPOLLS_KEY = "meetspan.mypolls";

export function saveAdminToken(pollId: string, token: string): void {
  try {
    localStorage.setItem(ADMIN_PREFIX + pollId, token);
  } catch {
    /* ignore private-mode failures */
  }
}

export function loadAdminToken(pollId: string): string | null {
  try {
    return localStorage.getItem(ADMIN_PREFIX + pollId);
  } catch {
    return null;
  }
}

/** A poll the organizer created on this browser (holds the admin token). */
export interface MyPoll {
  pollId: string;
  token: string;
  title: string;
  createdAt: number;
}

export function listMyPolls(): MyPoll[] {
  try {
    const raw = localStorage.getItem(MYPOLLS_KEY);
    const list = raw ? (JSON.parse(raw) as MyPoll[]) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function addMyPoll(p: MyPoll): void {
  try {
    const list = listMyPolls().filter((x) => x.pollId !== p.pollId);
    list.unshift(p);
    localStorage.setItem(MYPOLLS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function removeMyPoll(pollId: string): void {
  try {
    const list = listMyPolls().filter((x) => x.pollId !== pollId);
    localStorage.setItem(MYPOLLS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export interface StoredParticipant {
  id: string;
  codename: string;
  tz: string;
  email?: string;
}

export function saveParticipant(pollId: string, p: StoredParticipant): void {
  try {
    localStorage.setItem(PART_PREFIX + pollId, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function loadParticipant(pollId: string): StoredParticipant | null {
  try {
    const raw = localStorage.getItem(PART_PREFIX + pollId);
    return raw ? (JSON.parse(raw) as StoredParticipant) : null;
  } catch {
    return null;
  }
}
