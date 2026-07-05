import { useEffect, useMemo, useRef, useState } from "react";
import {
  COMMON_TZS,
  allTzNames,
  groupTimeZones,
  tzInfo,
  type TzGroup,
  type TzInfo,
} from "../lib/slots";

interface Props {
  value: string;
  onChange: (tz: string) => void;
  label?: string;
}

type Row =
  | { kind: "header"; key: string; label: string }
  | { kind: "option"; key: string; info: TzInfo };

/**
 * Searchable timezone picker. Type to filter across all IANA zones, grouped by
 * region (地域分类) and offset-sorted within each group (时区排序). Every zone
 * shows its code in parentheses, e.g. "Los Angeles (PDT)".
 */
export default function TimezonePicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Full zone list grouped by region. Guarantee the current value is present
  // even if the runtime's list happens to omit it (e.g. an alias).
  const groups = useMemo<TzGroup[]>(() => {
    const names = allTzNames();
    if (value && !names.includes(value)) names.push(value);
    return groupTimeZones(names);
  }, [value]);

  const selected = useMemo(() => tzInfo(value), [value]);

  // Flatten (optionally filtered) groups into renderable rows. A "Common"
  // group is pinned on top until the user starts typing.
  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    const hit = (info: TzInfo) => terms.every((t) => info.search.includes(t));
    const out: Row[] = [];
    if (!q) {
      out.push({ kind: "header", key: "h:common", label: "Common" });
      for (const tz of COMMON_TZS)
        out.push({ kind: "option", key: `common:${tz}`, info: tzInfo(tz) });
    }
    for (const g of groups) {
      const zones = q ? g.zones.filter(hit) : g.zones;
      if (!zones.length) continue;
      out.push({ kind: "header", key: `h:${g.region}`, label: g.label });
      for (const info of zones)
        out.push({ kind: "option", key: `${g.region}:${info.tz}`, info });
    }
    return out;
  }, [groups, query]);

  // Row indices that are selectable options (for keyboard navigation).
  const optionIdxs = useMemo(
    () =>
      rows.reduce<number[]>((acc, r, i) => {
        if (r.kind === "option") acc.push(i);
        return acc;
      }, []),
    [rows]
  );

  // Keep the active option in range as the filtered list changes.
  useEffect(() => {
    setActive((a) => (a < optionIdxs.length ? a : 0));
  }, [optionIdxs.length]);

  // Scroll the highlighted option into view.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(".tz-opt.active")
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open, rows]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(tz: string) {
    onChange(tz);
    setQuery("");
    setActive(0);
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, optionIdxs.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && optionIdxs.length) {
        e.preventDefault();
        const row = rows[optionIdxs[active]];
        if (row?.kind === "option") choose(row.info.tz);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setQuery("");
      }
    }
  }

  return (
    <div className="field tz-field" ref={rootRef}>
      {label && <span className="field-label">{label}</span>}
      <div className="tz-combo">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          spellCheck={false}
          className="tz-input"
          value={open ? query : `${selected.city} (${selected.abbr})`}
          placeholder={`${selected.city} (${selected.abbr})`}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <span className="tz-caret" aria-hidden>
          ▾
        </span>
        {open && (
          <ul className="tz-list" role="listbox" ref={listRef}>
            {rows.map((row, i) =>
              row.kind === "header" ? (
                <li key={row.key} className="tz-group" role="presentation">
                  {row.label}
                </li>
              ) : (
                <li
                  key={row.key}
                  role="option"
                  aria-selected={row.info.tz === value}
                  className={
                    "tz-opt" +
                    (i === optionIdxs[active] ? " active" : "") +
                    (row.info.tz === value ? " sel" : "")
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(row.info.tz);
                  }}
                  onMouseEnter={() => setActive(optionIdxs.indexOf(i))}
                >
                  <span className="tz-city">
                    {row.info.city}{" "}
                    <span className="tz-abbr">({row.info.abbr})</span>
                  </span>
                  <span className="tz-off">{row.info.offsetLabel}</span>
                </li>
              )
            )}
            {rows.length === 0 && (
              <li className="tz-empty">No matching timezone</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
