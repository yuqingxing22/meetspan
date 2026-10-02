import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import {
  COMMON_TZS,
  allTzNames,
  canonicalTz,
  groupTimeZones,
  searchTimeZones,
  tzInfo,
  type TzGroup,
  type TzInfo,
} from "../lib/slots";
import Icon from "./Icon";
import { t } from "../lib/i18n";

interface Props {
  value: string;
  onChange: (tz: string) => void;
  label?: string;
}

type Row =
  | { kind: "header"; key: string; label: string }
  | { kind: "option"; key: string; info: TzInfo };

/**
 * Searchable timezone picker. With no query it lists common zones, then every
 * IANA zone grouped by region (地域分类) and offset-sorted (时区排序). Typing
 * ranks matches best first. Every zone shows its code in parentheses, e.g.
 * "Los Angeles (PDT)", and its current local time.
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
    if (value && !names.some((n) => canonicalTz(n) === canonicalTz(value))) names.push(value);
    return groupTimeZones(names);
  }, [value]);

  const selected = useMemo(() => tzInfo(value), [value]);

  // No query: a "Common" group on top, then every region. With a query: one
  // flat list, best match first.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (query.trim()) {
      const all = groups.flatMap((g) => g.zones);
      for (const info of searchTimeZones(all, query))
        out.push({ kind: "option", key: `hit:${info.tz}`, info });
      return out;
    }
    out.push({ kind: "header", key: "h:common", label: "Common" });
    for (const tz of COMMON_TZS)
      out.push({ kind: "option", key: `common:${tz}`, info: tzInfo(tz) });
    for (const g of groups) {
      out.push({ kind: "header", key: `h:${g.region}`, label: g.label });
      for (const info of g.zones)
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
          <Icon name="chevronDown" />
        </span>
        {open && (
          <ul className="tz-list" role="listbox" ref={listRef}>
            {rows.map((row, i) =>
              row.kind === "header" ? (
                <li key={row.key} className="tz-group" role="presentation">
                  {t(row.label)}
                </li>
              ) : (
                <li
                  key={row.key}
                  role="option"
                  aria-selected={row.info.key === selected.key}
                  className={
                    "tz-opt" +
                    (i === optionIdxs[active] ? " active" : "") +
                    (row.info.key === selected.key ? " sel" : "")
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
                  <span className="tz-right">
                    <span className="tz-now">{nowIn(row.info.tz)}</span>
                    <span className="tz-off">{row.info.offsetLabel}</span>
                  </span>
                </li>
              )
            )}
            {rows.length === 0 && (
              <li className="tz-empty">{t("No matching timezone")}</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Current local time in `tz`, e.g. "3:20 PM", with "+1" / "−1" if it's another day there. */
function nowIn(tz: string): string {
  const here = DateTime.now();
  const dt = here.setZone(tz);
  if (!dt.isValid) return "";
  const days = Math.round(
    DateTime.fromISO(dt.toISODate()!).diff(DateTime.fromISO(here.toISODate()!), "days").days
  );
  return dt.toFormat("h:mm a") + (days > 0 ? ` +${days}` : days < 0 ? ` −${-days}` : "");
}
