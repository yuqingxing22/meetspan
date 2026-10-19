import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import Icon from "../components/Icon";
import { MAX_TEMPLATES, MAX_TEMPLATE_TEXT, setPrefs, usePrefs, type EmailTemplate } from "../lib/prefs";
import { TEMPLATE_FIELDS, fillTemplate, sampleTemplateValues, starterTemplate } from "../lib/email";
import { getLang, t } from "../lib/i18n";

type Field = "subject" | "body" | "optionsBody";

/** Settings → Email templates: the user's own email categories and their text. */
export default function SettingsTemplates() {
  const { templates } = usePrefs();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function save(tpl: EmailTemplate) {
    const exists = templates.some((x) => x.id === tpl.id);
    setPrefs({ templates: exists ? templates.map((x) => (x.id === tpl.id ? tpl : x)) : [...templates, tpl] });
    setEditing(null);
  }

  if (editing) return <Editor initial={editing} onSave={save} onCancel={() => setEditing(null)} />;

  const full = templates.length >= MAX_TEMPLATES;
  return (
    <section className="card">
      <div className="settings-section-head">
        <div>
          <h2>{t("Email templates")}</h2>
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

      {templates.length === 0 ? (
        <div className="empty-box">{t("No templates yet. Make one for an email you send often, like a lab meeting or office hours.")}</div>
      ) : (
        <ul className="tpl-list">
          {templates.map((x) => (
            <li key={x.id} className="tpl-item">
              <div className="tpl-main">
                <span className="tpl-name">{x.name || t("Untitled template")}</span>
                <span className="tpl-subject">{x.subject}</span>
              </div>
              {confirmDelete === x.id ? (
                <div className="btn-row tpl-actions">
                  <span className="small">{t("Delete this template?")}</span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(null)}>
                    {t("Cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      setPrefs({ templates: templates.filter((y) => y.id !== x.id) });
                      setConfirmDelete(null);
                    }}
                  >
                    {t("Delete")}
                  </button>
                </div>
              ) : (
                <div className="btn-row tpl-actions">
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(x)}>
                    {t("Edit")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setEditing({ ...x, id: nanoid(10), name: t("{name} (copy)", { name: x.name }) })}
                    disabled={full}
                  >
                    {t("Duplicate")}
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-quiet"
                    aria-label={t("Delete {name}", { name: x.name || t("Untitled template") })}
                    onClick={() => setConfirmDelete(x.id)}
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
  const canSave = tpl.name.trim() !== "" && tpl.body.trim() !== "";

  return (
    <section className="card tpl-editor">
      <div className="settings-section-head">
        <h2>{initial.name ? t("Edit template") : t("New template")}</h2>
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
