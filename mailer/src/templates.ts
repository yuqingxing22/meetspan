import { escapeHtml as h } from "./logic";

export type Lang = "en" | "zh";
export interface Mail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = "#4f46e5";
const INK = "#14151a";
const BODY = "#3d4049";
const FAINT = "#6b6f7a";

/** Table-based, inline-styled layout: renders the same in Gmail, Outlook and Apple Mail. */
function layout(opts: {
  lang: Lang;
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote: string;
}): string {
  const { lang, preheader, heading, paragraphs, cta, footnote } = opts;
  const contact =
    lang === "zh"
      ? "有问题？直接回复这封邮件，或写信到"
      : "Questions? Just reply to this email, or write to";
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${BODY};">${p}</p>`)
    .join("");
  const button = cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${BRAND};"><a href="${h(cta.url)}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${h(cta.label)}</a></td></tr></table>`
    : "";
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${h(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e6e8ee;">
<tr><td style="padding:28px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="font-size:18px;font-weight:700;color:${BRAND};letter-spacing:-0.2px;">MeetSpan</div>
</td></tr>
<tr><td style="padding:8px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<h1 style="margin:16px 0 16px;font-size:24px;line-height:32px;color:${INK};">${h(heading)}</h1>
${body}${button}
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #eef0f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:${FAINT};">
${h(footnote)}<br>${h(contact)} <a href="mailto:hello@meetspan.app" style="color:${FAINT};">hello@meetspan.app</a>.<br>
<a href="https://meetspan.app/#/privacy" style="color:${FAINT};">${lang === "zh" ? "隐私政策" : "Privacy"}</a> · © ${new Date().getFullYear()} MeetSpan
</td></tr></table></td></tr></table></body></html>`;
}

function firstName(name: string | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function welcomeEmail(lang: Lang, siteUrl: string, name?: string): Mail {
  const who = firstName(name);
  if (lang === "zh") {
    const hi = who ? `${who}，欢迎使用 MeetSpan` : "欢迎使用 MeetSpan";
    const p = [
      "你已经连接了 Google 账号，现在可以在任何设备上找回自己创建的排期。",
      "MeetSpan 帮你在不同时区的人之间找到大家都方便的时间：创建排期，把链接发给大家，每个人用自己的时区勾选有空的时段，剩下的交给我们。",
    ];
    return {
      subject: "欢迎使用 MeetSpan",
      html: layout({ lang, preheader: "你的排期现在可以在任何设备上找回。", heading: hi, paragraphs: p.map(h), cta: { label: "创建一个排期", url: siteUrl }, footnote: "你收到这封邮件，是因为你刚刚在 MeetSpan 连接了 Google 账号。这是一次性的欢迎邮件。" }),
      text: `${hi}\n\n${p.join("\n\n")}\n\n创建一个排期：${siteUrl}\n\n你收到这封邮件，是因为你刚刚在 MeetSpan 连接了 Google 账号。`,
    };
  }
  const hi = who ? `Welcome to MeetSpan, ${who}` : "Welcome to MeetSpan";
  const p = [
    "Your Google account is connected, so you can find the polls you create on any device.",
    "MeetSpan finds a time that works across timezones: create a poll, share the link, everyone marks when they’re free in their own timezone, and we do the rest.",
  ];
  return {
    subject: "Welcome to MeetSpan",
    html: layout({ lang, preheader: "Your polls now follow you to any device.", heading: hi, paragraphs: p.map(h), cta: { label: "Create a poll", url: siteUrl }, footnote: "You’re receiving this one-time welcome because you just connected a Google account on MeetSpan." }),
    text: `${hi}\n\n${p.join("\n\n")}\n\nCreate a poll: ${siteUrl}\n\nYou’re receiving this because you just connected a Google account on MeetSpan.`,
  };
}

export function inviteEmail(
  lang: Lang,
  a: { organizerName: string; title: string; url: string; deadline?: string }
): Mail {
  const org = a.organizerName.trim() || (lang === "zh" ? "有人" : "Someone");
  if (lang === "zh") {
    const p = [
      `${h(org)} 邀请你为“${h(a.title)}”选择方便的时间。`,
      "点下面的按钮，用你自己的时区勾选有空的时段，不需要注册。" + (a.deadline ? `请在 ${h(a.deadline)} 前填写。` : ""),
    ];
    return {
      subject: `${org} 邀请你选择时间：${a.title}`,
      html: layout({ lang, preheader: `${org} 想知道你什么时候方便。`, heading: "请选择你方便的时间", paragraphs: p, cta: { label: "选择时间", url: a.url }, footnote: `这封邮件由 ${org} 通过 MeetSpan 发送给你。如果你不认识对方，可以忽略它。` }),
      text: `${org} 邀请你为“${a.title}”选择方便的时间。\n\n${a.url}\n\n这封邮件由 ${org} 通过 MeetSpan 发送。`,
    };
  }
  const p = [
    `${h(org)} invited you to pick a time for “${h(a.title)}”.`,
    "Open the link and mark when you’re free, in your own timezone. No sign-up needed." + (a.deadline ? ` Please reply by ${h(a.deadline)}.` : ""),
  ];
  return {
    subject: `${org} invited you to pick a time: ${a.title}`,
    html: layout({ lang, preheader: `${org} wants to know when you’re free.`, heading: "Pick a time that works for you", paragraphs: p, cta: { label: "Choose your times", url: a.url }, footnote: `${org} sent you this through MeetSpan. If you don’t know them, you can ignore it.` }),
    text: `${org} invited you to pick a time for “${a.title}”.\n\n${a.url}\n\n${org} sent you this through MeetSpan.`,
  };
}

export function allRespondedEmail(
  lang: Lang,
  a: { title: string; count: number; url: string }
): Mail {
  if (lang === "zh") {
    const p = [`“${h(a.title)}”预计的 ${a.count} 位参与者都已经填写完毕。`, "现在可以查看大家的共同时间，选定会议时间了。"];
    return {
      subject: `所有人都已回复：${a.title}`,
      html: layout({ lang, preheader: "可以选定时间了。", heading: "所有人都已回复", paragraphs: p, cta: { label: "查看结果", url: a.url }, footnote: "你收到这封邮件，是因为你是这个排期的组织者。每个排期只会提醒一次。" }),
      text: `“${a.title}”预计的 ${a.count} 位参与者都已经填写完毕。\n\n查看结果：${a.url}`,
    };
  }
  const p = [`All ${a.count} people you expected have replied to “${h(a.title)}”.`, "You can now look at the overlap and lock in a time."];
  return {
    subject: `Everyone has replied: ${a.title}`,
    html: layout({ lang, preheader: "Time to pick a slot.", heading: "Everyone has replied", paragraphs: p, cta: { label: "See the results", url: a.url }, footnote: "You’re receiving this because you organized this poll. We only send it once per poll." }),
    text: `All ${a.count} people you expected have replied to “${a.title}”.\n\nSee the results: ${a.url}`,
  };
}
