import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DateTime } from "luxon";
import Icon from "./Icon";
import { MYPOLLS_EVENT, listMyPolls, removeMyPoll, type MyPoll } from "../lib/adminStore";
import { listPollsByOrganizer } from "../lib/poll";
import { isFirebaseConfigured } from "../firebase";
import { useAuthState } from "../lib/useAuthState";
import { t } from "../lib/i18n";

/**
 * Topbar "Your polls" dropdown. Merges polls created in this browser (which
 * carry the admin token) with polls tied to this account on the server (any
 * device where the same Google account is signed in).
 */
export default function YourPollsMenu() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const auth = useAuthState();
  const uid = typeof auth === "string" && auth !== "loading" && auth !== "error" ? auth : null;

  const [open, setOpen] = useState(false);
  const [localPolls, setLocalPolls] = useState<MyPoll[]>(() => listMyPolls());
  const [cloudPolls, setCloudPolls] = useState<MyPoll[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCloud = useCallback(() => {
    if (!isFirebaseConfigured || !uid) return () => {};
    let alive = true;
    listPollsByOrganizer(uid)
      .then((list) => {
        if (!alive) return;
        setCloudPolls(
          list.map(({ pollId, meta }) => ({
            pollId,
            token: "",
            title: meta.title,
            createdAt: meta.createdAt,
          }))
        );
      })
      .catch((e) => console.error("Couldn't load your polls", e));
    return () => {
      alive = false;
    };
  }, [uid]);

  // Re-read on navigation so a poll created a moment ago shows up.
  useEffect(() => {
    setLocalPolls(listMyPolls());
    return refreshCloud();
  }, [refreshCloud, pathname]);

  // A poll created (or forgotten) on this page updates the list right away.
  useEffect(() => {
    const onChange = () => setLocalPolls(listMyPolls());
    window.addEventListener(MYPOLLS_EVENT, onChange);
    return () => window.removeEventListener(MYPOLLS_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cloudIds = useMemo(() => new Set(cloudPolls.map((p) => p.pollId)), [cloudPolls]);
  // Local entries carry the admin token; cloud-only ones are opened by uid.
  const polls = useMemo(() => {
    const byId = new Map<string, MyPoll>();
    cloudPolls.forEach((p) => byId.set(p.pollId, p));
    localPolls.forEach((p) => byId.set(p.pollId, p));
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  }, [cloudPolls, localPolls]);

  if (polls.length === 0) return null;

  return (
    <div className="menu-root" ref={rootRef}>
      <button
        type="button"
        className="btn btn-sm"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="calendar" />
        <span className="hide-narrow">{t("Your polls")}</span>
        <span className="count-badge">{polls.length}</span>
      </button>
      {open && (
        <div className="menu menu-wide">
          <div className="menu-title">{t("Your polls")}</div>
          {polls.map((p) => (
            <div key={p.pollId} className="mypoll">
              <button
                type="button"
                className="mypoll-open"
                onClick={() => {
                  setOpen(false);
                  nav(p.token ? `/o/${p.pollId}?k=${p.token}` : `/o/${p.pollId}`);
                }}
              >
                <span className="mypoll-title">{p.title || t("Untitled poll")}</span>
                <span className="mypoll-date">
                  {DateTime.fromMillis(p.createdAt).toFormat("LLL d, yyyy")}
                </span>
              </button>
              {!cloudIds.has(p.pollId) && (
                <button
                  type="button"
                  className="icon-btn icon-btn-quiet"
                  aria-label={t("Remove {name} from this list", { name: p.title || t("Untitled poll") })}
                  title={t("Remove from this list (doesn't delete the poll)")}
                  onClick={() => {
                    const name = p.title || t("Untitled poll");
                    if (
                      window.confirm(
                        t("Hide “{name}” from this list? The poll itself is not deleted and its links keep working. To delete it, open the poll and choose ⋯ → Delete poll.", { name })
                      )
                    )
                      removeMyPoll(p.pollId);
                  }}
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          ))}
          <p className="menu-foot">
            {uid
              ? t("Saved in this browser and under your account. Removing one here doesn't delete the poll.")
              : t("Saved in this browser. Removing one here doesn't delete the poll.")}
          </p>
        </div>
      )}
    </div>
  );
}
