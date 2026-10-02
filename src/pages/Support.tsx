import { Link } from "react-router-dom";
import { getLang, t } from "../lib/i18n";

const EN = {
  intro: "Need a hand with MeetSpan? Write to us and we’ll get back to you as soon as we can.",
  rows: [
    ["Help with a poll or a bug", "support@meetspan.app"],
    ["Ideas and general feedback", "hello@meetspan.app"],
    ["Privacy questions and data deletion", "privacy@meetspan.app"],
  ],
  tipsTitle: "To help us help you",
  tips: [
    "Include the poll’s invite link, never the private organizer link.",
    "Tell us what you expected and what happened instead.",
    "Mention your browser (for example Chrome or Safari) and whether you’re on a phone or a computer.",
  ],
  quick: "Quick answers to common questions are in the",
};
const ZH = {
  intro: "使用 MeetSpan 时需要帮助？请给我们写信，我们会尽快回复。",
  rows: [
    ["排期问题或发现故障", "support@meetspan.app"],
    ["想法和一般反馈", "hello@meetspan.app"],
    ["隐私问题和数据删除", "privacy@meetspan.app"],
  ],
  tipsTitle: "为了更快帮到你",
  tips: [
    "请附上排期的邀请链接，不要发私密的组织者链接。",
    "告诉我们你预期的结果，以及实际发生了什么。",
    "说明你用的浏览器（比如 Chrome 或 Safari），以及用的是手机还是电脑。",
  ],
  quick: "常见问题的快速解答在",
};

export default function Support() {
  const c = getLang() === "zh" ? ZH : EN;
  return (
    <div className="narrow prose">
      <h1 className="page-title">{t("Support")}</h1>
      <p>{c.intro}</p>
      <div className="support-rows">
        {c.rows.map(([label, mail]) => (
          <div key={mail} className="support-row">
            <span>{label}</span>
            <a href={`mailto:${mail}`}>{mail}</a>
          </div>
        ))}
      </div>
      <h2>{c.tipsTitle}</h2>
      <ul>
        {c.tips.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <p>
        {c.quick} <Link to="/faq">{t("FAQ")}</Link>.
      </p>
    </div>
  );
}
