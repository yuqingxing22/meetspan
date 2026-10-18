import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import PollList from "./PollList";
import { useMyPolls } from "../lib/useMyPolls";
import { useToast } from "../lib/useToast";
import { t } from "../lib/i18n";

/** How many polls the menu shows; the rest are under Settings → Your polls. */
const MENU_LIMIT = 4;

/** Topbar "Your polls" dropdown: the latest few polls, batch actions, and a way to all of them. */
export default function YourPollsMenu() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { polls, refresh } = useMyPolls();
  const { show, node } = useToast();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Re-read on navigation so a poll created a moment ago shows up.
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

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

  if (polls.length === 0) return <>{node}</>;

  const more = polls.length - MENU_LIMIT;

  return (
    <div className="menu-root" ref={rootRef} data-tour="polls">
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
          <PollList
            polls={polls.slice(0, MENU_LIMIT)}
            onOpen={(p) => {
              setOpen(false);
              nav(p.token ? `/o/${p.pollId}?k=${p.token}` : `/o/${p.pollId}`);
            }}
            onChanged={refresh}
            onMessage={show}
          />
          <Link to="/settings?tab=polls" className="menu-more" onClick={() => setOpen(false)}>
            {more > 0 ? t("More ({n})", { n: more }) : t("All polls")}
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      )}
      {node}
    </div>
  );
}
