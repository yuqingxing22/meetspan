import { formatRange } from "./slots";
import { getLang, withLang, type Lang } from "./i18n";
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
  /** Email language; defaults to the interface language. */
  lang?: Lang;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

function freqLabel(f: number, lang: Lang): string {
  if (lang === "zh") return `每周 ${Math.max(1, f)} 次`;
  if (f <= 1) return "once a week";
  if (f === 2) return "twice a week";
  return `${f}× a week`;
}

/** Sessions listed in the organizer's timezone, with each attendee's local time. */
function sessionBlock(input: EmailInput, lang: Lang): string {
  const { meta, sessions, participants } = input;
  const lines: string[] = [];
  sessions.forEach((s, i) => {
    const label =
      lang === "zh"
        ? sessions.length > 1
          ? `第 ${i + 1} 次`
          : "时间"
        : sessions.length > 1
        ? `Session ${i + 1}`
        : "Time";
    lines.push(`  ${label}${lang === "zh" ? "：" : ": "}${formatRange(s.startMs, s.endMs, meta.organizerTz)}`);
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

interface Flavor {
  subjectTag: string;
  intro: string;
  outro: string;
  extra: string;
}

function flavorZh(type: MeetingType): Flavor {
  switch (type) {
    case "team":
      return {
        subjectTag: "团队例会",
        intro: "感谢大家提供空闲时间。根据大家重叠的时间，我们的定期例会安排如下：",
        extra: "议程：[填写议程]\n会议链接：[填写视频会议链接]\n请把时间加到日历里，方便我们保持节奏。",
        outro: "到时见，",
      };
    case "one_on_one":
      return {
        // Neutral and polite either way (student ↔ advisor, colleague ↔ colleague).
        subjectTag: "一对一",
        intro: "感谢您提供空闲时间，以下时间我们都方便：",
        extra: "讨论内容：[填写话题]\n会议链接：[填写视频会议链接]",
        outro: "如时间有变，请随时告知。谢谢！",
      };
    case "study":
      return {
        subjectTag: "学习小组",
        intro: "谢谢大家提供空闲时间。我们的学习小组 / 研讨会时间定在：",
        extra: "本次重点：[填写阅读材料 / 主题]\n地点 / 链接：[填写教室或视频会议链接]\n欢迎带着问题来！",
        outro: "期待与大家一起讨论，",
      };
    case "interview":
      return {
        subjectTag: "面试",
        intro: "感谢您的配合。现确认通话时间如下：",
        extra: "会议链接：[填写视频会议链接]\n议程：[填写议程 / 需要准备的内容]\n如需改期，请尽早告知。",
        outro: "期待与您交流，谢谢！",
      };
  }
}

function flavor(type: MeetingType): Flavor {
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
  const lang = input.lang ?? getLang();
  // Dates in the email follow the email's language, not the interface's.
  return withLang(lang, () => (lang === "zh" ? generateZh(input) : generateEn(input)));
}

function generateEn(input: EmailInput): GeneratedEmail {
  const { meetingName, durationMin, sessionsPerWeek, type, meta, sessions } =
    input;
  const f = flavor(type);
  const cadence =
    sessions.length > 1
      ? `${durationMin} min each, ${freqLabel(sessionsPerWeek, "en")}`
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
    sessionBlock(input, "en"),
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

function generateZh(input: EmailInput): GeneratedEmail {
  const { meetingName, durationMin, sessionsPerWeek, type, meta, sessions } = input;
  const f = flavorZh(type);
  const cadence =
    sessions.length > 1
      ? `每次 ${durationMin} 分钟，${freqLabel(sessionsPerWeek, "zh")}`
      : `${durationMin} 分钟`;

  const subject = `${meetingName}：拟定时间（${f.subjectTag}）`;

  const body = [
    type === "one_on_one" || type === "interview" ? "您好，" : "大家好，",
    "",
    f.intro,
    "",
    `会议：${meetingName}`,
    `时长：${cadence}`,
    "",
    sessionBlock(input, "zh"),
    "",
    f.extra,
    "",
    type === "one_on_one" || type === "interview"
      ? "如果这个时间合适，请回复确认；如需调整也请告知。"
      : "如果这个时间可以，请回复确认；如需调整也请告诉我。",
    "",
    f.outro,
    meta.organizerName || "[你的名字]",
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
