import { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import Calendar from "./Calendar";
import Icon from "./Icon";
import { t } from "../lib/i18n";

interface Props {
  /** ISO date (yyyy-mm-dd), or "" for none. */
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  /** Shown when empty (default "Pick a date"). */
  placeholder?: string;
  /** How to show the chosen date (default "Fri, Dec 18, 2026"). */
  format?: (iso: string) => string;
  /** Hide the × (when empty already means something, e.g. "this week"). */
  clearable?: boolean;
}

/**
 * Optional single-date field. The browser's own date input formats dates by
 * the browser's language (mm/dd/yyyy even on the Chinese page), so this shows
 * the date in the page's language and opens our calendar instead.
 */
export default function DateField({ value, onChange, id, placeholder, format, clearable = true }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = value ? (format ? format(value) : DateTime.fromISO(value).toFormat("ccc, LLL d, yyyy")) : "";

  return (
    <div className="date-field" ref={rootRef}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className={"date-field-btn" + (value ? "" : " empty")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="calendar" size={16} />
        <span>{label || placeholder || t("Pick a date")}</span>
      </button>
      {value && clearable && (
        <button
          type="button"
          className="date-field-clear"
          aria-label={t("Clear date")}
          title={t("Clear date")}
          onClick={() => onChange("")}
        >
          <Icon name="x" size={14} />
        </button>
      )}
      {open && (
        <div className="date-field-pop" role="dialog" aria-label={t("Pick a date")}>
          <Calendar
            selectedDates={new Set(value ? [value] : [])}
            initialMonth={value || undefined}
            onDayClick={(iso) => {
              onChange(iso);
              setOpen(false);
              buttonRef.current?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}
