import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import Icon from "../components/Icon";
import {
  EMPTY_TEXT,
  MAX_TEMPLATES,
  MAX_TEMPLATE_TEXT,
  setPrefs,
  usePrefs,
  type EmailTemplate,
  type TemplateText,
} from "../lib/prefs";
import {
  TEMPLATE_FIELDS,
  builtinTemplate,
  fillTemplate,
  sampleTemplateValues,
  starterTemplate,
  templateTextFor,
} from "../lib/email";
import { MEETING_TYPES, type MeetingType } from "../lib/types";
import { getLang, t, type Lang } from "../lib/i18n";

type Field = keyof TemplateText;
const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
];
const LANG_NAME: Record<Lang, string> = { en: "English", zh: "中文" };

const written = (x: TemplateText) => x.body.trim() !== "";
const same = (a: TemplateText, b: TemplateText) =>
  a.subject === b.subject && a.body === b.body && (a.optionsBody || a.body) === (b.optionsBody || b.body);

/** Both versions of a built-in category as it is used now: the user's edit, else the original. */
function builtinTexts(type: MeetingType, mine: EmailTemplate | undefined): Pick<EmailTemplate, "en" | "zh"> {
  const pick = (lang: Lang) => (mine && written(mine[lang]) ? mine[lang] : builtinTemplate(type, lang));
  return { en: pick("en"), zh: pick("zh") };
}

/** Settings → Email templates: the built-in categories (editable) and the user's own, each in English and Chinese. */
export default function SettingsTemplates() {
  const { templates } = usePrefs();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const custom = templates.filter((x) => !x.builtin);
  const full = custom.length >= MAX_TEMPLATES;
  const ui = getLang();

  function save(tpl: EmailTemplate) {
    if (tpl.builtin) {
      // A version left as the original isn't stored, so it keeps adjusting its
      // wording; nor is an unchanged name, so it follows the interface language.
      const type = tpl.builtin;
      const label = MEETING_TYPES.find((m) => m.value === type)!.label;
      const keep = (lang: Lang) => (same(tpl[lang], builtinTemplate(type, lang)) ? { ...EMPTY_TEXT } : tpl[lang]);
      tpl = { ...tpl, name: tpl.name === t(label) ? "" : tpl.name, en: keep("en"), zh: keep("zh") };
      if (!tpl.name && !written(tpl.en) && !written(tpl.zh)) {
        setPrefs({ templates: templates.filter((x) => x.builtin !== type) });
        setEditing(null);
        return;
      }
    }
    const exists = templates.some((x) => x.id === tpl.id);
    setPrefs({ templates: exists ? templates.map((x) => (x.id === tpl.id ? tpl : x)) : [...templates, tpl] });
    setEditing(null);
  }
  const remove = (id: string) => {
    setPrefs({ templates: templates.filter((y) => y.id !== id) });
    setConfirm(null);
  };
  const copyOf = (name: string, texts: Pick<EmailTemplate, "en" | "zh">): EmailTemplate => ({
    id: nanoid(10),
    name: t("{name} (copy)", { name }),
    en: { ...texts.en },
    zh: { ...texts.zh },
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
              {t("The emails MeetSpan writes for each meeting type, in English and Chinese. Edit one to use your own wording; you can restore the original any time.")}
            </p>
          </div>
        </div>
        <ul className="tpl-list">
          {MEETING_TYPES.map((m) => {
            const mine = templates.find((x) => x.builtin === m.value);
            const texts = builtinTexts(m.value, mine);
            const name = mine?.name || t(m.label);
            const edited = LANGS.filter((l) => mine && written(mine[l.id])).map((l) => l.label);
            const key = `builtin:${m.value}`;
            return (
              <li key={m.value} className="tpl-item">
                <div className="tpl-main">
                  <span className="tpl-name">
                    {name}{" "}
                    <span className={`tpl-badge${mine ? " edited" : ""}`}>
                      {mine ? (edited.length ? t("Edited: {langs}", { langs: edited.join(" · ") }) : t("Edited")) : t("Built in")}
                    </span>
                  </span>
                  <span className="tpl-subject">{texts[ui].subject}</span>
                </div>
                {confirm === key ? (
                  confirmRow(t("Go back to the original text?"), t("Restore"), () => mine && remove(mine.id))
                ) : (
                  <div className="btn-row tpl-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setEditing({ id: mine?.id ?? `builtin-${m.value}`, builtin: m.value, name, ...texts })}
                    >
                      {t("Edit")}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" disabled={full} onClick={() => setEditing(copyOf(name, texts))}>
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
          {t("A version you haven't edited adjusts its wording on its own (one person or a group, one time or several). An edited version is used as you wrote it.")}
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
            onClick={() => setEditing({ id: nanoid(10), name: "", en: starterTemplate("en"), zh: starterTemplate("zh") })}
          >
            <Icon name="plus" /> {t("New template")}
          </button>
        </div>

        {custom.length === 0 ? (
          <div className="empty-box">{t("No templates yet. Make one for an email you send often, like a lab meeting or office hours.")}</div>
        ) : (
          <ul className="tpl-list">
            {custom.map((x) => {
              const missing = LANGS.filter((l) => !written(x[l.id]));
              return (
                <li key={x.id} className="tpl-item">
                  <div className="tpl-main">
                    <span className="tpl-name">
                      {x.name || t("Untitled template")}{" "}
                      {missing.length === 1 && (
                        <span className="tpl-badge">{t("{lang} only", { lang: LANG_NAME[missing[0].id === "en" ? "zh" : "en"] })}</span>
                      )}
                    </span>
                    <span className="tpl-subject">{templateTextFor(x, ui)?.text.subject}</span>
                  </div>
                  {confirm === x.id ? (
                    confirmRow(t("Delete this template?"), t("Delete"), () => remove(x.id))
                  ) : (
                    <div className="btn-row tpl-actions">
                      <button type="button" className="btn btn-sm" onClick={() => setEditing(x)}>
                        {t("Edit")}
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(copyOf(x.name, x))} disabled={full}>
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
              );
            })}
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
  // Which language version is being edited; starts with the interface language.
  const [lang, setLang] = useState<Lang>(getLang());
  const [preview, setPreview] = useState<"body" | "optionsBody">("body");
  const [showOptions, setShowOptions] = useState<Record<Lang, boolean>>({
    en: !!initial.en.optionsBody.trim(),
    zh: !!initial.zh.optionsBody.trim(),
  });
  const text = tpl[lang];
  // The field the placeholder buttons insert into, and where its cursor was.
  const last = useRef<{ field: Field; start: number; end: number }>({ field: "body", start: text.body.length, end: text.body.length });
  const refs = {
    subject: useRef<HTMLInputElement>(null),
    body: useRef<HTMLTextAreaElement>(null),
    optionsBody: useRef<HTMLTextAreaElement>(null),
  };
  const builtin = initial.builtin;
  const other: Lang = lang === "zh" ? "en" : "zh";

  const setText = (field: Field, value: string) => setTpl((x) => ({ ...x, [lang]: { ...x[lang], [field]: value } }));
  const track = (field: Field) => (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => {
    last.current = { field, start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 };
  };

  function switchTo(next: Lang) {
    setLang(next);
    setPreview("body");
    last.current = { field: "body", start: tpl[next].body.length, end: tpl[next].body.length };
  }

  function insert(key: string) {
    const { field, start, end } = last.current;
    const token = `{${key}}`;
    const value = text[field];
    setText(field, value.slice(0, start) + token + value.slice(end));
    const pos = start + token.length;
    last.current = { field, start: pos, end: pos };
    requestAnimationFrame(() => {
      const el = refs[field].current;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  /** Where this language version stands, shown on its tab. */
  function status(l: Lang): string {
    if (builtin) return same(tpl[l], builtinTemplate(builtin, l)) ? t("Original") : t("Edited");
    return written(tpl[l]) ? t("Written") : t("Not written");
  }

  const values = sampleTemplateValues(lang);
  const shownBody = preview === "optionsBody" && text.optionsBody.trim() ? text.optionsBody : text.body;
  // A built-in category keeps its own name when the name is cleared.
  const canSave = (!!builtin || tpl.name.trim() !== "") && (written(tpl.en) || written(tpl.zh));

  return (
    <section className="card tpl-editor">
      <div className="settings-section-head">
        <h2>{builtin ? t("Edit a built-in category") : initial.name ? t("Edit template") : t("New template")}</h2>
        <div className="btn-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canSave}
            onClick={() =>
              onSave({
                ...tpl,
                name: tpl.name.trim(),
                en: { ...tpl.en, optionsBody: showOptions.en ? tpl.en.optionsBody : "" },
                zh: { ...tpl.zh, optionsBody: showOptions.zh ? tpl.zh.optionsBody : "" },
              })
            }
          >
            {t("Save template")}
          </button>
        </div>
      </div>

      <label className="field tpl-name-field">
        <span className="field-label">{t("Category name")}</span>
        <input
          type="text"
          value={tpl.name}
          maxLength={60}
          placeholder={t("e.g. Lab meeting, Office hours")}
          onChange={(e) => setTpl((x) => ({ ...x, name: e.target.value }))}
        />
      </label>

      <div className="tpl-lang-tabs" role="tablist" aria-label={t("Email language")}>
        {LANGS.map((l) => (
          <button
            type="button"
            key={l.id}
            role="tab"
            aria-selected={lang === l.id}
            className={lang === l.id ? "active" : ""}
            onClick={() => switchTo(l.id)}
          >
            {l.label}
            <span className="tpl-lang-status">{status(l.id)}</span>
          </button>
        ))}
      </div>
      <p className="hint">
        {t("An email uses the version in its own language, so you can write in Chinese and still send in English.")}{" "}
        {builtin
          ? t("A version you leave as the original keeps adjusting its wording on its own.")
          : t("If one version is left empty, emails in that language use the other one.")}
      </p>

      <div className="tpl-grid">
        <div>
          {!builtin && !written(text) && (
            <div className="tpl-empty-lang">
              <span>{t("The {lang} version isn't written yet.", { lang: LANG_NAME[lang] })}</span>
              <button type="button" className="btn btn-sm" onClick={() => setTpl((x) => ({ ...x, [lang]: starterTemplate(lang) }))}>
                {t("Start from a draft")}
              </button>
            </div>
          )}

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
                  onClick={() => insert(lang === "zh" ? f.zh : f.key)}
                >
                  {`{${lang === "zh" ? f.zh : f.key}}`} <span className="muted">{t(f.label)}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field-label">{t("Subject")}</span>
            <input
              ref={refs.subject}
              type="text"
              value={text.subject}
              maxLength={300}
              onChange={(e) => setText("subject", e.target.value)}
              onSelect={track("subject")}
              onFocus={track("subject")}
            />
          </label>
          <label className="field">
            <span className="field-label">{t("Email for a confirmed time")}</span>
            <textarea
              ref={refs.body}
              rows={14}
              value={text.body}
              maxLength={MAX_TEMPLATE_TEXT}
              onChange={(e) => setText("body", e.target.value)}
              onSelect={track("body")}
              onFocus={(e) => {
                track("body")(e);
                setPreview("body");
              }}
            />
          </label>

          <label className="tpl-toggle">
            <input
              type="checkbox"
              checked={showOptions[lang]}
              onChange={(e) => setShowOptions((s) => ({ ...s, [lang]: e.target.checked }))}
            />
            {t("Write a different email for sending several time options")}
          </label>
          {showOptions[lang] && (
            <label className="field">
              <span className="field-label">{t("Email for time options")}</span>
              <textarea
                ref={refs.optionsBody}
                rows={10}
                value={text.optionsBody}
                maxLength={MAX_TEMPLATE_TEXT}
                onChange={(e) => setText("optionsBody", e.target.value)}
                onSelect={track("optionsBody")}
                onFocus={(e) => {
                  track("optionsBody")(e);
                  setPreview("optionsBody");
                }}
              />
            </label>
          )}
          {builtin && !same(tpl[lang], builtinTemplate(builtin, lang)) && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                const original = builtinTemplate(builtin, lang);
                setTpl((x) => ({ ...x, [lang]: original }));
                setShowOptions((s) => ({ ...s, [lang]: true }));
              }}
            >
              {t("Put back the original {lang} text", { lang: LANG_NAME[lang] })}
            </button>
          )}
        </div>

        <div className="tpl-preview-col">
          <div className="tpl-preview-head">
            <span className="field-label">{t("Preview with sample details")}</span>
            {showOptions[lang] && (
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
            {written(text) ? (
              <>
                <div className="tpl-preview-subject">{fillTemplate(text.subject, values).replace(/\s*\n\s*/g, " ")}</div>
                <div className="email-preview">{fillTemplate(shownBody, values)}</div>
              </>
            ) : (
              <div className="email-preview muted">
                {written(tpl[other])
                  ? t("Emails in {lang} will use the {other} version.", { lang: LANG_NAME[lang], other: LANG_NAME[other] })
                  : t("Nothing written yet.")}
              </div>
            )}
          </div>
          <p className="hint">{t("In a real email, the times list every person in their own timezone.")}</p>
        </div>
      </div>
    </section>
  );
}
