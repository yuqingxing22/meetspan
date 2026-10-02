import { useMemo, useState } from "react";
import { generateEmail, gmailLink, mailtoLink, outlookLink } from "../lib/email";
import { buildICS, downloadICS } from "../lib/ics";
import { copyText, useToast } from "../lib/useToast";
import { MEETING_TYPES } from "../lib/types";
import type { Session } from "../lib/overlap";
import type { MeetingType, Participant, PollMeta } from "../lib/types";
import { getLang, t as tr, type Lang } from "../lib/i18n";

interface Props {
  meta: PollMeta;
  meetingName: string;
  durationMin: number;
  sessionsPerWeek: number;
  type: MeetingType;
  sessions: Session[];
  participants: Participant[];
  /** Emails collected from participants (organizer-only), for the "To" field. */
  recipientEmails: string[];
  /** The sessions are candidates for people to choose from, not a confirmed time. */
  options?: boolean;
  onClose: () => void;
}

// A short, OS-appropriate tip for enabling the system mail handler. Guarded so
// server render (no navigator) and unknown platforms degrade gracefully.
function defaultMailTip(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Macintosh|Mac OS X/i.test(ua))
    return tr("on a Mac, set one in Mail → Settings → General → “Default email reader.”");
  if (/Windows/i.test(ua))
    return tr("on Windows, set one in Settings → Apps → Default apps → Email.");
  if (/iPhone|iPad|iPod/i.test(ua))
    return tr("on iPhone/iPad, set a default in Settings → Apps → Mail → Default Mail App.");
  if (/Android/i.test(ua))
    return tr("on Android, pick a default in Settings → Apps → Default apps.");
  return tr("set a default email app in your system settings.");
}

export default function EmailModal({
  meta,
  meetingName,
  durationMin,
  sessionsPerWeek,
  type: initialType,
  sessions,
  participants,
  recipientEmails,
  options = false,
  onClose,
}: Props) {
  const { show, node } = useToast();
  const [type, setType] = useState<MeetingType>(initialType);
  const [emailLang, setEmailLang] = useState<Lang>(getLang());
  const mailTip = defaultMailTip();

  const email = useMemo(
    () =>
      generateEmail({
        meta,
        meetingName,
        durationMin,
        sessionsPerWeek,
        type,
        sessions,
        participants,
        lang: emailLang,
        options,
      }),
    [meta, meetingName, durationMin, sessionsPerWeek, type, sessions, participants, emailLang, options]
  );

  // Recipients collected from participants who shared an email (organizer-only).
  const emails = useMemo(
    () =>
      Array.from(
        new Set(recipientEmails.map((e) => e.trim()).filter((e) => e.includes("@")))
      ),
    [recipientEmails]
  );
  const to = emails.join(",");

  function saveIcs() {
    const ics = buildICS(
      {
        meta,
        meetingName,
        sessions,
        participants,
        recurring: meta.dateMode === "weekly",
      },
      Date.now()
    );
    const base = (meetingName || meta.title || "meeting")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    downloadICS(`${base || "meeting"}.ics`, ics);
    show(tr("Calendar file downloaded"));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{tr("Draft email")}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕ {tr("Close")}
          </button>
        </div>

        <div className="email-lang">
          <span className="field-label">{tr("Email language")}</span>
          <div className="seg seg-sm" role="group" aria-label={tr("Email language")}>
            <button
              type="button"
              className={emailLang === "en" ? "active" : ""}
              aria-pressed={emailLang === "en"}
              onClick={() => setEmailLang("en")}
            >
              English
            </button>
            <button
              type="button"
              className={emailLang === "zh" ? "active" : ""}
              aria-pressed={emailLang === "zh"}
              onClick={() => setEmailLang("zh")}
            >
              中文
            </button>
          </div>
        </div>

        <label className="field">
          <span className="field-label">{tr("Template (by meeting type)")}</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MeetingType)}
          >
            {MEETING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {tr(t.label)}
              </option>
            ))}
          </select>
        </label>

        <div className="field-label">{tr("Subject")}</div>
        <div className="linkbox" style={{ marginBottom: 12 }}>
          <code style={{ whiteSpace: "normal" }}>{email.subject}</code>
          <button
            className="btn btn-sm"
            onClick={() => {
              copyText(email.subject);
              show(tr("Subject copied"));
            }}
          >
            {tr("Copy")}
          </button>
        </div>

        <div className="field-label">{tr("Body")}</div>
        <div className="email-preview">{email.body}</div>

        <div className="spacer" />
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            copyText(`${email.subject}\n\n${email.body}`);
            show(tr("Email copied — paste it into any email"));
          }}
        >
          {tr("Copy email to clipboard")}
        </button>
        <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
          {tr("Works on any device — paste into Gmail, Outlook, Apple Mail, or whatever you use.")}
        </p>

        <div className="field-label" style={{ marginTop: 18 }}>
          {tr("Or open a ready-made draft in")}
        </div>
        <div className="compose-links">
          <a
            className="btn"
            href={gmailLink(email, to)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Gmail
          </a>
          <a
            className="btn"
            href={outlookLink(email, to)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Outlook
          </a>
          <a
            className="btn"
            href={mailtoLink(email, to)}
            onClick={() =>
              show(
                tr("Opening your email app… if nothing happens, no default email app is set — copy the email or use Gmail/Outlook instead.")
              )
            }
          >
            {tr("Mail app")}
          </a>
        </div>
        {emails.length > 0 ? (
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            {tr(emails.length === 1 ? "Recipients prefilled from 1 shared email: {list}" : "Recipients prefilled from {n} shared emails: {list}", {
              n: emails.length,
              list: emails.join(", "),
            })}
          </p>
        ) : (
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            {tr("No participant emails collected, so the “To” field is left blank — add recipients yourself.")}
          </p>
        )}
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          {tr("Gmail and Outlook open in your browser and work on any computer. “Mail app” opens your device’s default email program — {tip} If nothing opens, just copy the email above.", { tip: mailTip })}
        </p>

        <div className="divider" />
        {options ? (
          <p className="hint" style={{ margin: 0 }}>
            {tr("These are options, so nothing is locked in yet. Once people reply, tick the winning time and pick it to get a calendar file.")}
          </p>
        ) : (
          <>
          <div className="field-label">{tr("Add to everyone’s calendar")}</div>
          <button className="btn btn-block" onClick={saveIcs}>
            ⤓ {tr("Download calendar file (.ics)")}
          </button>
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            {tr(
              meta.dateMode === "weekly"
                ? "Opens in Apple Calendar, Google Calendar, Outlook and more. Attach it to the email so guests add it in one click — it shows in each person’s own timezone and repeats weekly."
                : "Opens in Apple Calendar, Google Calendar, Outlook and more. Attach it to the email so guests add it in one click — it shows in each person’s own timezone."
            )}
          </p>
          </>
        )}
        {node}
      </div>
    </div>
  );
}
