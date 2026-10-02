import { Link } from "react-router-dom";
import { getLang, t } from "../lib/i18n";

const UPDATED = "2026-10-02";
const CONTACT = "support@meetspan.app";

interface Section {
  h: string;
  p: string[];
}

const EN: Section[] = [
  {
    h: "Using MeetSpan",
    p: [
      "These terms apply when you use MeetSpan (meetspan.app). By using the service you agree to them. If you don’t agree, please don’t use it.",
      "MeetSpan helps groups find a meeting time across timezones. You can use it without an account. Some features, such as getting your organizer link by email or syncing your polls across devices, need you to sign in with Google.",
    ],
  },
  {
    h: "What you share",
    p: [
      "You’re responsible for what you put into MeetSpan: poll names, nicknames, availability and any email addresses. Don’t share anything that is unlawful, or that you don’t have the right to share.",
      "Anyone with a poll’s invite link can see its replies, so don’t put sensitive information in a poll. You give us permission to store and display what you submit, only as needed to run the service.",
    ],
  },
  {
    h: "Acceptable use",
    p: [
      "Please don’t use MeetSpan to harass anyone, send spam or unwanted messages, break the law, or interfere with the service, for example by overloading it, probing it for weaknesses or trying to access other people’s data.",
      "We may remove polls that break these rules.",
    ],
  },
  {
    h: "Your account",
    p: [
      "If you sign in with Google, you’re responsible for activity under your account. You can sign out at any time, and you can ask us to delete your data (see the privacy policy).",
    ],
  },
  {
    h: "The service as it is",
    p: [
      "MeetSpan is provided “as is”, without promises that it will always be available, error-free or fit for a particular purpose. Times are calculated carefully, but please double-check important meetings before relying on them.",
      "To the extent the law allows, we aren’t liable for losses that come from using, or being unable to use, MeetSpan, including missed or mistimed meetings.",
    ],
  },
  {
    h: "Changes",
    p: [
      "We may change or stop parts of MeetSpan, and we may update these terms. When we make an important change we’ll update the date at the top of this page. Continuing to use MeetSpan after a change means you accept the new terms.",
    ],
  },
  {
    h: "Contact",
    p: [`Questions about these terms: ${CONTACT}.`],
  },
];

const ZH_SECTIONS: Section[] = [
  {
    h: "使用 MeetSpan",
    p: [
      "你使用 MeetSpan（meetspan.app）时，这些条款即适用。使用本服务即表示你同意这些条款；如果不同意，请不要使用。",
      "MeetSpan 帮助团队找到跨时区的开会时间。不注册账号也可以使用；部分功能（比如通过邮件收到组织者链接、在不同设备上同步排期）需要你用 Google 登录。",
    ],
  },
  {
    h: "你提交的内容",
    p: [
      "你要对自己放进 MeetSpan 的内容负责，包括排期名称、昵称、空闲时间和邮箱。请不要提交违法的内容，或你无权分享的内容。",
      "任何拿到邀请链接的人都能看到排期里的回复，所以请不要在排期里放敏感信息。你授权我们仅为运行本服务的需要而保存和展示你提交的内容。",
    ],
  },
  {
    h: "使用规范",
    p: [
      "请不要用 MeetSpan 骚扰他人、发送垃圾邮件或不受欢迎的消息、从事违法活动，或干扰服务的运行，比如使其过载、探测漏洞，或试图访问他人的数据。",
      "对违反这些规则的排期，我们可能将其删除。",
    ],
  },
  {
    h: "你的账号",
    p: ["如果你用 Google 登录，你要对账号下的活动负责。你可以随时退出登录，也可以要求我们删除你的数据（见隐私政策）。"],
  },
  {
    h: "服务按现状提供",
    p: [
      "MeetSpan 按“现状”提供，我们不保证它始终可用、没有错误，或适合某个特定用途。我们会认真计算时间，但重要的会议请你在依赖结果之前再核对一遍。",
      "在法律允许的范围内，对于因使用或无法使用 MeetSpan 造成的损失（包括错过会议或时间弄错），我们不承担责任。",
    ],
  },
  {
    h: "变更",
    p: ["我们可能会调整或停止 MeetSpan 的部分功能，也可能更新这些条款。有重要变更时，我们会更新本页顶部的日期。变更之后你继续使用 MeetSpan，即表示接受新的条款。"],
  },
  {
    h: "联系我们",
    p: [`对这些条款有疑问，请联系：${CONTACT}。`],
  },
];

export default function Terms() {
  const zh = getLang() === "zh";
  const sections = zh ? ZH_SECTIONS : EN;
  return (
    <div className="narrow prose">
      <h1 className="page-title">{t("Terms of use")}</h1>
      <p className="prose-meta">{zh ? `最后更新：${UPDATED}` : `Last updated: ${UPDATED}`}</p>
      {sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((para) => (
            <p key={para}>{para}</p>
          ))}
        </section>
      ))}
      <p>
        <Link to="/privacy">{t("Privacy policy")}</Link>
        {" · "}
        <Link to="/">{t("Back to MeetSpan")}</Link>
      </p>
    </div>
  );
}
