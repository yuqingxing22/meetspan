import { Link } from "react-router-dom";
import { getLang, t } from "../lib/i18n";

const UPDATED = "2026-10-02";
const CONTACT = "privacy@meetspan.app";

interface Section {
  h: string;
  p: string[];
}

const EN: Section[] = [
  {
    h: "What MeetSpan is",
    p: [
      "MeetSpan helps people in different timezones find a time to meet. You create a poll, share the link, and everyone marks when they’re free. You don’t need an account to use it.",
    ],
  },
  {
    h: "What we collect",
    p: [
      "Poll data: the poll’s name, dates and hours, the organizer’s name and timezone, and the deadline and list of expected names if the organizer sets them.",
      "Replies: the name or nickname a participant types, their timezone, and the times they mark as free or “if needed”. Anyone with a poll’s link can see these replies.",
      "Email addresses (optional): a participant can leave an email address so the organizer can contact them. Only the organizer of that poll can read it.",
      "Google sign-in (optional): if you connect a Google account, we receive your name, email address and profile photo from Google. We use them to show who you’re signed in as, to find your polls on other devices, and to send the emails described below.",
      "My schedule (optional): the weekly times you save on the My schedule page, stored against your account.",
      "Google Calendar (optional): if you choose to import from Google Calendar, MeetSpan asks Google only for free/busy information (the times you’re busy, not event titles or details). It is used in your browser to pre-fill your availability, and the calendar data itself isn’t stored by us. MeetSpan’s use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements. We don’t use Google user data for advertising, and we don’t sell it or allow people to read it.",
      "Technical data: an anonymous sign-in ID so that you can edit your own replies, and a few settings kept in your browser (language, and which polls and replies are yours).",
    ],
  },
  {
    h: "Emails we send",
    p: [
      "We send a one-time welcome email the first time you connect a Google account; an email to a poll’s organizer when everyone they expected has replied; a message with your private organizer link to your own Google email address, if you choose “Email it to me”; and invitation emails when an organizer asks us to send their poll link to people they name (only a few at a time). We don’t send marketing email.",
      "These emails come from noreply@meetspan.app. You can reply to them and the reply reaches us.",
    ],
  },
  {
    h: "Who handles your data",
    p: [
      "We use a few services to run MeetSpan: Google Firebase (database and sign-in), GitHub Pages (hosting the website), Cloudflare (our domain, email forwarding and the service that sends emails) and Brevo (delivering emails). They process data on our behalf. We don’t sell your data and we don’t show ads.",
    ],
  },
  {
    h: "How long we keep it",
    p: [
      "We keep polls and replies until you ask us to delete them. We may also delete a poll, with its replies and any email addresses left in it, once it has had no activity for 12 months. To have your data removed sooner, write to the address below from the email you used (or tell us the poll link). Our service providers may keep their own logs for a short time under their own policies.",
    ],
  },
  {
    h: "Your choices",
    p: [
      "You can use MeetSpan without signing in or giving an email address. You can sign out at any time, and you can ask us to see, correct or delete your data.",
    ],
  },
  {
    h: "Contact",
    p: [`Questions or requests: ${CONTACT}.`],
  },
];

const ZH_SECTIONS: Section[] = [
  {
    h: "MeetSpan 是什么",
    p: ["MeetSpan 帮助身处不同时区的人找到大家都方便的开会时间。你创建一个排期，把链接发给大家，每个人勾选自己有空的时间。使用它不需要注册账号。"],
  },
  {
    h: "我们收集什么",
    p: [
      "排期信息：排期名称、日期和时段、组织者的名字和时区，以及组织者设置的截止日期和预计参与者名单。",
      "回复：参与者填写的名字或昵称、所在时区，以及标记为有空或“勉强可以”的时间。任何拿到排期链接的人都能看到这些回复。",
      "邮箱（可选）：参与者可以留下邮箱，方便组织者联系。只有该排期的组织者能看到。",
      "Google 登录（可选）：如果你连接 Google 账号，我们会从 Google 获得你的姓名、邮箱和头像。用途是显示你当前登录的账号、让你在其他设备上找回自己的排期，以及发送下面说明的邮件。",
      "我的常用时间（可选）：你在“我的常用时间”页面保存的每周时段，与你的账号关联。",
      "Google 日历（可选）：如果你选择从 Google 日历导入，MeetSpan 只向 Google 请求忙闲信息（你什么时候忙，不包括日程标题和内容）。这些信息只在你的浏览器里用来预填你的空闲时间，我们不会保存日历数据本身。MeetSpan 对从 Google API 获得的信息的使用和转移，将遵守 Google API Services User Data Policy（Google API 服务用户数据政策），包括其中的 Limited Use（有限使用）要求。我们不会把 Google 用户数据用于广告，不会出售，也不允许他人阅读这些数据。",
      "技术信息：一个匿名登录 ID，用来让你能修改自己的回复；以及保存在你浏览器里的少量设置（语言，以及哪些排期和回复是你的）。",
    ],
  },
  {
    h: "我们会发送的邮件",
    p: [
      "我们会在你第一次连接 Google 账号时发送一封欢迎邮件；当排期的组织者预计的人都回复后，给组织者发一封提醒；如果你选择“发邮件给自己”，把你的私密组织者链接发到你自己的 Google 邮箱；组织者要求我们把排期链接发给他们指定的人时，发送邀请邮件（一次只发几封）。我们不发营销邮件。",
      "这些邮件的发件地址是 noreply@meetspan.app。你可以直接回复，回复会到达我们这里。",
    ],
  },
  {
    h: "谁在处理你的数据",
    p: ["我们用几项服务来运行 MeetSpan：Google Firebase（数据库和登录）、GitHub Pages（网站托管）、Cloudflare（域名、邮件转发和发送邮件的服务）以及 Brevo（邮件投递）。它们是替我们处理数据的。我们不会出售你的数据，也不投放广告。"],
  },
  {
    h: "保存多久",
    p: ["排期和回复会一直保存，直到你要求我们删除。如果一个排期连续 12 个月没有任何活动，我们也可能把它连同其中的回复和留下的邮箱一并删除。想提前删除，请用你填写过的邮箱（或告诉我们排期链接）写信到下面的地址。我们的服务商可能会按各自的政策短期保留自己的日志。"],
  },
  {
    h: "你的选择",
    p: ["你可以不登录、不留邮箱就使用 MeetSpan。你随时可以退出登录，也可以要求我们查看、更正或删除你的数据。"],
  },
  {
    h: "联系我们",
    p: [`问题或请求请发送到：${CONTACT}。`],
  },
];

export default function Privacy() {
  const zh = getLang() === "zh";
  const sections = zh ? ZH_SECTIONS : EN;
  return (
    <div className="narrow prose">
      <h1 className="page-title">{t("Privacy policy")}</h1>
      <p className="prose-meta">
        {zh ? `最后更新：${UPDATED}` : `Last updated: ${UPDATED}`}
      </p>
      {sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((para) => (
            <p key={para}>{para}</p>
          ))}
        </section>
      ))}
      <p>
        <Link to="/">{t("Back to MeetSpan")}</Link>
      </p>
    </div>
  );
}
