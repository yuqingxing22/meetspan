import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import Icon from "../components/Icon";
import { MAX_TEMPLATES, MAX_TEMPLATE_TEXT, setPrefs, usePrefs, type EmailTemplate } from "../lib/prefs";
import { TEMPLATE_FIELDS, builtinTemplate, fillTemplate, sampleTemplateValues, starterTemplate } from "../lib/email";
import { MEETING_TYPES } from "../lib/types";
import { getLang, t } from "../lib/i18n";

type Field = "subject" | "body" | "optionsBody";

/** Settings → Email templates: the built-in categories (editable) and the user's own. */
export default function SettingsTemplates() {
  const { templates } = usePrefs();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const custom = templates.filter((x) => !x.builtin);
  const full = custom.length >= MAX_TEMPLATES;

  function save(tpl: EmailTemplate) {
    // An unchanged built-in name isn't stored, so it keeps following the interface language.
    const label = MEETING_TYPES.find((m) => m.value === tpl.builtin)?.label;
    if (label && tpl.name === t(label)) tpl = { ...tpl, name: "" };
    const exists = templates.some((x) => x.id === tpl.id);
    setPrefs({ templates: exists ? templates.map((x) => (x.id === tpl.id ? tpl : x)) : [...templates, tpl] });
    setEditing(null);
  }
  const remove = (id: string) => {
    setPrefs({ templates: templates.filter((y) => y.id !== id) });
    setConfirm(null);
  };
  const copyOf = (x: Pick<EmailTemplate, "name" | "subject" | "body" | "optionsBody">): EmailTemplate => ({
    id: nanoid(10),
    name: t("{name} (copy)", { name: x.name }),
    subject: x.subject,
    body: x.body,
    optionsBody: x.optionsBody,
  });

  if (editing) return <Editor initial={editing} onSave={save} onCancel={() => setEditing(null)} />;

  /** The confirm row that replaces a template's buttons. */
  const confirmRow = (question: string, action: string, onYes: () => void) => (
    <div className="btn-row tpl-actions">
      <span className="small">{question}</span>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(null)}>
        {t("Cancel")}
      </button>
      <button type="button" className="btn btn-sm btn-danger" onClick={onYes}>
        {action}
      </button>
    </div>
  );

  return (
    <div className="settings-stack">
      <section className="card">
        <div className="settings-section-head">
          <div>
            <h2>{t("Built-in categories")}</h2>
            <p className="page-sub">
              {t("The emails MeetSpan writes for each meeting type. Edit one to use your own wording; you can restore the original any time.")}
            </p>
          </div>
        </div>
        <ul className="tpl-list">
          {MEETING_TYPES.map((m) => {
            const mine = templates.find((x) => x.builtin === m.value);
            const original = { name: t(m.label), ...builtinTemplate(m.value, getLang()) };
            const shown = mine ?? original;
            const key = `builtin:${m.value}`;
            return (
              <li key={m.value} className="tpl-item">
                <div className="tpl-main">
                  <span className="tpl-name">
                    {shown.name || original.name}{" "}
                    <span className={`tpl-badge${mine ? " edited" : ""}`}>{mine ? t("Edited") : t("Built in")}</span>
                  </span>
                  <span className="tpl-subject">{shown.subject}</span>
                </div>
                {confirm === key ? (
                  confirmRow(t("Go back to the original text?"), t("Restore"), () => mine && remove(mine.id))
                ) : (
                  <div className="btn-row tpl-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setEditing(mine ?? { id: `builtin-${m.value}`, builtin: m.value, ...original })}
                    >
                      {t("Edit")}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" disabled={full} onClick={() => setEditing(copyOf(shown))}>
                      {t("Duplicate")}
                    </button>
                    {mine && (
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(key)}>
                        {t("Restore default")}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="hint tpl-note">
          {t("Unedited categories adjust their wording on their own (one person or a group, one time or several, English or Chinese). An edited one is used as you wrote it.")}
        </p>
      </section>

      <section className="card">
        <div className="settings-section-head">
          <div>
            <h2>{t("My templates")}</h2>
            <p className="page-sub">
              {t("Your own email categories. They show up next to the built-in ones under “Meeting type” on the poll page and in the email draft.")}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={full}
            title={full ? t("You can keep up to {n} templates.", { n: MAX_TEMPLATES }) : undefined}
            onClick={() => setEditing({ id: nanoid(10), name: "", ...starterTemplate(getLang()) })}
          >
            <Icon name="plus" /> {t("New template")}
          </button>
        </div>

        {custom.length === 0 ? (
          <div className="empty-box">{t("No templates yet. Make one for an email you send often, like a lab meeting or office hours.")}</div>
        ) : (
          <ul className="tpl-list">
            {custom.map((x) => (
              <li key={x.id} className="tpl-item">
                <div className="tpl-main">
                  <span className="tpl-name">{x.name || t("Untitled template")}</span>
                  <span className="tpl-subject">{x.subject}</span>
                </div>
                {confirm === x.id ? (
                  confirmRow(t("Delete this template?"), t("Delete"), () => remove(x.id))
                ) : (
                  <div className="btn-row tpl-actions">
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(x)}>
                      {t("Edit")}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(copyOf(x))} disabled={full}>
                      {t("Duplicate")}
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-quiet"
                      aria-label={t("Delete {name}", { name: x.name || t("Untitled template") })}
                      onClick={() => setConfirm(x.id)}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Editor({
  initial,
  onSave,
  onCancel,
}: {
  initial: EmailTemplate;
  onSave: (t: EmailTemplate) => void;
  onCancel: () => void;
}) {
  const [tpl, setTpl] = useState(initial);
  const [preview, setPreview] = useState<"body" | "optionsBody">("body");
  const [showOptions, setShowOptions] = useState(!!initial.optionsBody.trim());
  // The field the placeholder buttons insert into, and where its cursor was.
  const last = useRef<{ field: Field; start: number; end: number }>({ field: "body", start: initial.body.length, end: initial.body.length });
  const refs = {
    subject: useRef<HTMLInputElement>(null),
    body: useRef<HTMLTextAreaElement>(null),
    optionsBody: useRef<HTMLTextAreaElement>(null),
  };
  const zh = getLang() === "zh";

  const set = (field: Field | "name", value: string) => setTpl((x) => ({ ...x, [field]: value }));
  const track = (field: Field) => (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => {
    last.current = { field, start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 };
  };

  function insert(key: string) {
    const { field, start, end } = last.current;
    const token = `{${key}}`;
    const text = tpl[field];
    set(field, text.slice(0, start) + token + text.slice(end));
    const pos = start + token.length;
    last.current = { field, start: pos, end: pos };
    requestAnimationFrame(() => {
      const el = refs[field].current;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  const values = sampleTemplateValues(getLang());
  const shownBody = preview === "optionsBody" && tpl.optionsBody.trim() ? tpl.optionsBody : tpl.body;
  // A built-in category keeps its own name when the name is cleared.
  const canSave = (!!tpl.builtin || tpl.name.trim() !== "") && tpl.body.trim() !== "";

  return (
    <section className="card tpl-editor">
      <div className="settings-section-head">
        <h2>{initial.builtin ? t("Edit a built-in category") : initial.name ? t("Edit template") : t("New template")}</h2>
        <div className="btn-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canSave}
            onClick={() => onSave({ ...tpl, name: tpl.name.trim(), optionsBody: showOptions ? tpl.optionsBody : "" })}
          >
            {t("Save template")}
          </button>
        </div>
      </div>

      <div className="tpl-grid">
        <div>
          <label className="field">
            <span className="field-label">{t("Category name")}</span>
            <input
              type="text"
              value={tpl.name}
              maxLength={60}
              placeholder={t("e.g. Lab meeting, Office hours")}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>

          <div className="tpl-insert" role="group" aria-label={t("Insert a placeholder")}>
            <span className="field-label">{t("Insert a placeholder")}</span>
            <div className="chips chips-sm">
              {TEMPLATE_FIELDS.map((f) => (
                <button
                  type="button"
                  key={f.key}
                  className="chip"
                  title={t(f.label)}
                  // Keep the cursor in the text field.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(zh ? f.zh : f.key)}
                >
                  {`{${zh ? f.zh : f.key}}`} <span className="muted">{t(f.label)}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field-label">{t("Subject")}</span>
            <input
              ref={refs.subject}
              type="text"
              value={tpl.subject}
              maxLength={300}
              onChange={(e) => set("subject", e.target.value)}
              onSelect={track("subject")}
              onFocus={track("subject")}
            />
          </label>
          <label className="field">
            <span className="field-label">{t("Email for a confirmed time")}</span>
            <textarea
              ref={refs.body}
              rows={14}
              value={tpl.body}
              maxLength={MAX_TEMPLATE_TEXT}
              onChange={(e) => set("body", e.target.value)}
              onSelect={track("body")}
              onFocus={(e) => {
                track("body")(e);
                setPreview("body");
              }}
            />
          </label>

          <label className="tpl-toggle">
            <input type="checkbox" checked={showOptions} onChange={(e) => setShowOptions(e.target.checked)} />
            {t("Write a different email for sending several time options")}
          </label>
          {showOptions && (
            <label className="field">
              <span className="field-label">{t("Email for time options")}</span>
              <textarea
                ref={refs.optionsBody}
                rows={10}
                value={tpl.optionsBody}
                maxLength={MAX_TEMPLATE_TEXT}
                onChange={(e) => set("optionsBody", e.target.value)}
                onSelect={track("optionsBody")}
                onFocus={(e) => {
                  track("optionsBody")(e);
                  setPreview("optionsBody");
                }}
              />
            </label>
          )}
        </div>

        <div className="tpl-preview-col">
          <div className="tpl-preview-head">
            <span className="field-label">{t("Preview with sample details")}</span>
            {showOptions && (
              <div className="seg seg-sm" role="group">
                <button type="button" className={preview === "body" ? "active" : ""} onClick={() => setPreview("body")}>
                  {t("Confirmed")}
                </button>
                <button type="button" className={preview === "optionsBody" ? "active" : ""} onClick={() => setPreview("optionsBody")}>
                  {t("Options")}
                </button>
              </div>
            )}
          </div>
          <div className="tpl-preview">
            <div className="tpl-preview-subject">{fillTemplate(tpl.subject, values).replace(/\s*\n\s*/g, " ")}</div>
            <div className="email-preview">{fillTemplate(shownBody, values)}</div>
          </div>
          <p className="hint">{t("In a real email, the times list every person in their own timezone.")}</p>
        </div>
      </div>
    </section>
  );
}
