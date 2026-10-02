import { useState } from "react";
import DateField from "./DateField";
import { MAX_REPEAT_WEEKS, repeatEndError } from "../lib/repeat";
import type { RepeatEnd } from "../lib/types";
import { t } from "../lib/i18n";

type Kind = "never" | "count" | "until";

interface Props {
  value: RepeatEnd | undefined;
  onChange: (end: RepeatEnd | undefined) => void;
  /** First meeting day (ISO), to check an end date against. */
  firstDate?: string;
}

/** "Ends": no end date / after N weeks / on a date, for weekly meetings. */
export default function RepeatEndField({ value, onChange, firstDate }: Props) {
  const kind: Kind = !value ? "never" : "count" in value ? "count" : "until";
  // Keep what was typed while switching kinds back and forth.
  const [count, setCount] = useState(value && "count" in value ? String(value.count) : "10");
  const [until, setUntil] = useState(value && "until" in value ? value.until : "");
  const error = repeatEndError(value, firstDate);

  function setKind(k: Kind) {
    if (k === "never") onChange(undefined);
    else if (k === "count") onChange({ count: Number(count) });
    else onChange({ until });
  }

  return (
    <div className="field repeat-end">
      <label className="field-label" htmlFor="repeat-end-kind">
        {t("Ends")}
      </label>
      <div className="repeat-end-row">
        <select id="repeat-end-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          <option value="never">{t("No end date")}</option>
          <option value="count">{t("After a number of weeks")}</option>
          <option value="until">{t("On a date")}</option>
        </select>
        {kind === "count" && (
          <label className="repeat-count">
            <input
              type="number"
              min={1}
              max={MAX_REPEAT_WEEKS}
              inputMode="numeric"
              value={count}
              aria-label={t("Number of weeks")}
              onChange={(e) => {
                setCount(e.target.value);
                onChange({ count: Number(e.target.value) });
              }}
            />
            <span>{t("weeks")}</span>
          </label>
        )}
        {kind === "until" && (
          <DateField
            value={until}
            placeholder={t("Last day")}
            clearable={false}
            onChange={(iso) => {
              setUntil(iso);
              onChange({ until: iso });
            }}
          />
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
