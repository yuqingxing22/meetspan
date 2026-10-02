import { useEffect, useMemo, useRef, useState } from "react";
import { forgetTitle, listRecentTitles, type RecentTitle } from "../lib/titleHistory";
import Icon from "./Icon";
import { t } from "../lib/i18n";

interface Props {
  id?: string;
  value: string;
  onChange: (title: string) => void;
  placeholder?: string;
}

/**
 * Meeting-name input that offers names used before on this browser. The list
 * opens on focus, narrows as you type, and each entry can be removed.
 */
export default function TitleInput({ id, value, onChange, placeholder }: Props) {
  const [recent, setRecent] = useState<RecentTitle[]>(() => listRecentTitles());
  const [open, setOpen] = useState(false);
  // -1 = nothing highlighted, so Enter never replaces what was typed by accident.
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter((r) => {
      const s = r.title.toLowerCase();
      return s.includes(q) && s !== q;
    });
  }, [recent, value]);

  const showList = open && matches.length > 0;

  useEffect(() => {
    setActive(-1);
  }, [value, open]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(title: string) {
    onChange(title);
    setOpen(false);
  }

  function remove(title: string) {
    setRecent(forgetTitle(title));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter") {
      if (showList && active >= 0) {
        e.preventDefault();
        choose(matches[active].title);
      }
    } else if (e.key === "Escape") {
      if (showList) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="tz-combo title-combo" ref={rootRef}>
      <input
        id={id}
        type="text"
        className="input-lg"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="tz-list" role="listbox">
          <li className="tz-group" role="presentation">
            {t("Recent meeting names")}
          </li>
          {matches.map((r, i) => (
            <li
              key={r.title}
              role="option"
              aria-selected={i === active}
              className={"tz-opt title-opt" + (i === active ? " active" : "")}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r.title);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="title-opt-text">{r.title}</span>
              <button
                type="button"
                className="title-opt-remove"
                aria-label={t("Remove “{title}” from history", { title: r.title })}
                title={t("Remove from history")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(r.title);
                }}
              >
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
