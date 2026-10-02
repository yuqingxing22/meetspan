import { Link } from "react-router-dom";
import { getLang, t } from "../lib/i18n";

const EN = {
  blocks: [
    ["Why MeetSpan exists", "Finding a meeting time is hard enough. Doing it across timezones, with people who each have to convert times in their head, is worse. MeetSpan was built so that nobody has to do the math: everyone marks when they’re free in their own timezone, and MeetSpan finds the overlap."],
    ["What we care about", "Simple: no sign-up, one link, a few clicks. Correct: times are stored once and shown in each person’s own timezone, including daylight saving. Respectful: we collect only what the tool needs, we don’t show ads, and we don’t sell your data."],
    ["Who’s behind it", "MeetSpan is a small independent project. We read every message, and your feedback shapes what we build next."],
  ],
  cta: "Try it",
  contact: "Say hello at",
  notices: "Open-source software, fonts and illustrations used in MeetSpan",
};
const ZH = {
  blocks: [
    ["为什么做 MeetSpan", "找一个大家都方便的开会时间本来就不容易，跨时区时每个人还要在脑子里换算，更麻烦。MeetSpan 就是为了让大家不用再算时差：每个人按自己的时区勾选有空的时间，MeetSpan 帮你找出重叠的时段。"],
    ["我们在意什么", "简单：无需注册，一个链接，点几下就好。准确：时间只存一份，按每个人自己的时区显示，包括夏令时。尊重：只收集工具必需的信息，不投放广告，也不出售你的数据。"],
    ["背后是谁", "MeetSpan 是一个小型的独立项目。我们会阅读每一条来信，你的反馈会影响我们接下来要做的事情。"],
  ],
  cta: "试一试",
  contact: "来信请发送到",
  notices: "MeetSpan 使用的开源软件、字体和插图（第三方许可说明）",
};

export default function About() {
  const c = getLang() === "zh" ? ZH : EN;
  return (
    <div className="narrow prose">
      <h1 className="page-title">{t("About MeetSpan")}</h1>
      {c.blocks.map(([h, p]) => (
        <section key={h}>
          <h2>{h}</h2>
          <p>{p}</p>
        </section>
      ))}
      <p>
        <Link to="/" className="btn">
          {c.cta}
        </Link>
      </p>
      <p>
        {c.contact} <a href="mailto:hello@meetspan.app">hello@meetspan.app</a>.
      </p>
      <p className="prose-meta">
        <a href={`${import.meta.env.BASE_URL}third-party-notices.txt`} target="_blank" rel="noopener">
          {c.notices}
        </a>
      </p>
    </div>
  );
}
