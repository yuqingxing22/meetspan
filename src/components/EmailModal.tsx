import { useMemo, useState } from "react";
import { generateEmail, gmailLink, mailtoLink, outlookLink } from "../lib/email";
import { buildICS, downloadICS } from "../lib/ics";
import { copyText, useToast } from "../lib/useToast";
import { MEETING_TYPES } from "../lib/types";
import type { Session } from "../lib/overlap";
import type { MeetingType, Participant, PollMeta } from "../lib/types";

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
  onClose: () => void;
}

// A short, OS-appropriate tip for enabling the system mail handler. Guarded so
// server render (no navigator) and unknown platforms degrade gracefully.
function defaultMailTip(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Macintosh|Mac OS X/i.test(ua))
    return "on a Mac, set one in Mail → Settings → General → “Default email reader.”";
  if (/Windows/i.test(ua))
    return "on Windows, set one in Settings → Apps → Default apps → Email.";
  if (/iPhone|iPad|iPod/i.test(ua))
    return "on iPhone/iPad, set a default in Settings → Apps → Mail → Default Mail App.";
  if (/Android/i.test(ua))
    return "on Android, pick a default in Settings → Apps → Default apps.";
  return "set a default email app in your system settings.";
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
  onClose,
}: Props) {
  const { show, node } = useToast();
  const [type, setType] = useState<MeetingType>(initialType);
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
      }),
    [meta, meetingName, durationMin, sessionsPerWeek, type, sessions, participants]
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
    show("Calendar file downloaded");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Draft email</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <label className="field">
          <span className="field-label">Template (by meeting type)</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MeetingType)}
          >
            {MEETING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field-label">Subject</div>
        <div className="linkbox" style={{ marginBottom: 12 }}>
          <code style={{ whiteSpace: "normal" }}>{email.subject}</code>
          <button
            className="btn btn-sm"
            onClick={() => {
              copyText(email.subject);
              show("Subject copied");
            }}
          >
            Copy
          </button>
        </div>

        <div className="field-label">Body</div>
        <div className="email-preview">{email.body}</div>

        <div className="spacer" />
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            copyText(`${email.subject}\n\n${email.body}`);
            show("Email copied — paste it into any email");
          }}
        >
          Copy email to clipboard
        </button>
        <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
          Works on any device — paste into Gmail, Outlook, Apple Mail, or
          whatever you use.
        </p>

        <div className="field-label" style={{ marginTop: 18 }}>
          Or open a ready-made draft in
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
                "Opening your email app… if nothing happens, no default email app is set — copy the email or use Gmail/Outlook instead."
              )
            }
          >
            Mail app
          </a>
        </div>
        {emails.length > 0 ? (
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            Recipients prefilled from {emails.length} shared email
            {emails.length === 1 ? "" : "s"}: {emails.join(", ")}
          </p>
        ) : (
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            No participant emails collected, so the “To” field is left blank —
            add recipients yourself.
          </p>
        )}
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Gmail and Outlook open in your browser and work on any computer.
          “Mail app” opens your device’s default email program — {mailTip} If
          nothing opens, just copy the email above.
        </p>

        <div className="divider" />
        <div className="field-label">Add to everyone’s calendar</div>
        <button className="btn btn-block" onClick={saveIcs}>
          ⤓ Download calendar file (.ics)
        </button>
        <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
          Opens in Apple Calendar, Google Calendar, Outlook and more. Attach it
          to the email so guests add the {sessions.length === 1 ? "time" : "times"}{" "}
          in one click — it shows in each person’s own timezone
          {meta.dateMode === "weekly" ? " and repeats weekly" : ""}.
        </p>
        {node}
      </div>
    </div>
  );
}
