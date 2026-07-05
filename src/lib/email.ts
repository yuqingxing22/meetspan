import { formatRange } from "./slots";
import type { Session } from "./overlap";
import type { MeetingType, Participant, PollMeta } from "./types";

export interface EmailInput {
  meta: PollMeta;
  meetingName: string;
  durationMin: number;
  sessionsPerWeek: number;
  type: MeetingType;
  sessions: Session[];
  participants: Participant[];
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

function freqLabel(f: number): string {
  if (f <= 1) return "once a week";
  if (f === 2) return "twice a week";
  return `${f}× a week`;
}

/** Sessions listed in the organizer's timezone, with each attendee's local time. */
function sessionBlock(input: EmailInput): string {
  const { meta, sessions, participants } = input;
  const lines: string[] = [];
  sessions.forEach((s, i) => {
    const label = sessions.length > 1 ? `Session ${i + 1}` : "Time";
    lines.push(`  ${label}: ${formatRange(s.startMs, s.endMs, meta.organizerTz)}`);
    // Attendees who are free for this window, in their own timezone.
    const free = participants.filter((p) => s.freeIds.includes(p.id));
    const shown = free.length ? free : participants;
    for (const p of shown) {
      lines.push(
        `      • ${p.codename} — ${formatRange(s.startMs, s.endMs, p.tz)}`
      );
    }
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}

function flavor(type: MeetingType): {
  subjectTag: string;
  intro: string;
  outro: string;
  extra: string;
} {
  switch (type) {
    case "team":
      return {
        subjectTag: "Recurring team sync",
        intro:
          "Thanks everyone for sharing your availability. Based on when we all overlap, here's the proposed schedule for our recurring team sync:",
        extra:
          "Agenda: [add agenda items]\nMeeting link: [add video call link]\nPlease add these to your calendars so we keep the cadence.",
        outro: "See you there,",
      };
    case "one_on_one":
      return {
        subjectTag: "1:1",
        intro:
          "Thanks for letting me know your availability. Here's a time that works for both of us:",
        extra:
          "Agenda / things to cover: [add topics]\nMeeting link: [add video call link]",
        outro: "Looking forward to catching up,",
      };
    case "study":
      return {
        subjectTag: "Study group",
        intro:
          "Thanks all for sending your availability. Here's when we can meet for our study group / seminar:",
        extra:
          "Focus for this session: [add readings / topics]\nLocation / link: [add room or video link]\nBring your questions!",
        outro: "Happy studying,",
      };
    case "interview":
      return {
        subjectTag: "Interview",
        intro:
          "Thank you for your flexibility. I'd like to confirm the following time for our call:",
        extra:
          "Meeting link: [add video call link]\nAgenda: [add agenda / what to prepare]\nIf you need to reschedule, please let me know as soon as possible.",
        outro: "Best regards,",
      };
  }
}

export function generateEmail(input: EmailInput): GeneratedEmail {
  const { meetingName, durationMin, sessionsPerWeek, type, meta, sessions } =
    input;
  const f = flavor(type);
  const cadence =
    sessions.length > 1
      ? `${durationMin} min each, ${freqLabel(sessionsPerWeek)}`
      : `${durationMin} min`;

  const subject = `${meetingName} — proposed time${
    sessions.length > 1 ? "s" : ""
  } (${f.subjectTag})`;

  const body = [
    "Hi all,",
    "",
    f.intro,
    "",
    `Meeting: ${meetingName}`,
    `Duration: ${cadence}`,
    "",
    sessionBlock(input),
    "",
    f.extra,
    "",
    "Please reply to confirm this works for you, or suggest an adjustment.",
    "",
    f.outro,
    meta.organizerName || "[your name]",
  ].join("\n");

  return { subject, body };
}

// Encode a query string with %20 for spaces and %0A for newlines. We can't use
// URLSearchParams here: it encodes spaces as "+", which mailto: clients render
// as literal plus signs rather than spaces.
function qs(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

/** mailto: link — opens whatever desktop mail client the OS has registered. */
export function mailtoLink(email: GeneratedEmail, to = ""): string {
  // Email addresses need no percent-encoding in the mailto target; commas
  // separate multiple recipients.
  const params = qs({ subject: email.subject, body: email.body });
  return `mailto:${to}?${params}`;
}

/** Gmail compose URL — opens a prefilled draft in the browser (no OS handler needed). */
export function gmailLink(email: GeneratedEmail, to = ""): string {
  return `https://mail.google.com/mail/?${qs({
    view: "cm",
    fs: "1",
    to,
    su: email.subject,
    body: email.body,
  })}`;
}

/** Outlook (web) compose URL — prefilled draft in the browser. */
export function outlookLink(email: GeneratedEmail, to = ""): string {
  return `https://outlook.office.com/mail/deeplink/compose?${qs({
    to,
    subject: email.subject,
    body: email.body,
  })}`;
}
