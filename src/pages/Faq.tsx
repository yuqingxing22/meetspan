import { Link } from "react-router-dom";
import { getLang, t } from "../lib/i18n";

interface Item {
  q: string;
  a: string[];
}

const EN: Item[] = [
  {
    q: "What is MeetSpan?",
    a: ["MeetSpan helps a group in different timezones find a time to meet. You create a poll, share one link, and everyone marks when they’re free, in their own timezone. MeetSpan finds where the times overlap."],
  },
  {
    q: "Do I need an account?",
    a: ["No. You can create a poll and reply to one without signing up. You can even save your usual weekly times on the My schedule page without one (they stay in this browser). Signing in with Google is optional: it lets you find your polls and your usual times on other devices."],
  },
  {
    q: "How do I create a poll and invite people?",
    a: ["On the home page, enter a name for the meeting, pick the days (specific dates or a repeating week), set the hours and your timezone, then create the poll. You get an invite link to share with your group. Anyone with the link can add their times."],
  },
  {
    q: "What’s the difference between the invite link and the organizer link?",
    a: ["The invite link is the one you share. The private organizer link is your key: it’s how you see results and lock in the final time. Keep it to yourself, and never post it in a group chat."],
  },
  {
    q: "How do people add their times?",
    a: ["They open the invite link, type a name or nickname, check their timezone, and paint the times they’re free. They can also mark times as “if needed” for slots that are possible but not ideal."],
  },
  {
    q: "Will everyone see times in their own timezone?",
    a: ["Yes. Times are stored once and shown to each person in their own timezone, including daylight saving changes, so nobody has to do the conversion."],
  },
  {
    q: "How does MeetSpan choose a time?",
    a: ["It looks for windows where everyone overlaps for the full length of the meeting. If nothing fits, it suggests alternatives such as a shorter meeting, splitting the meeting across days, or leaving out one person, each with concrete times."],
  },
  {
    q: "I lost my organizer link. What can I do?",
    a: ["Polls you created are saved under “Your polls” in the browser you used. If you were signed in with Google when you created the poll, you can find it under “Your polls” on any device after signing in again. If neither works, contact support and include the invite link (never the organizer link)."],
  },
  {
    q: "Who can see my replies?",
    a: ["Anyone with the invite link can see the names and times that people have entered, because that’s how the group overlap is shown. An email address, if someone chooses to leave one, can be read only by the organizer. See the privacy policy for details."],
  },
  {
    q: "Does MeetSpan read my calendar?",
    a: ["Only if you choose “import from Google Calendar”. In that case it asks Google for your free/busy times only, never event titles or details, and uses them in your browser to pre-fill your availability."],
  },
  {
    q: "Does MeetSpan send emails?",
    a: ["Only a few, all from noreply@meetspan.app: a one-time welcome when you first connect a Google account, and your private organizer link, sent to your Google email when you create a poll while signed in with Google. We don’t send marketing email. If you reply to one of these emails, your reply reaches us."],
  },
  {
    q: "Can I close a poll?",
    a: ["Yes. On your organizer page, open the ⋯ menu and choose “Close poll”. People who open the invite link can still see the poll, but they can no longer add or change their times. You can choose “Reopen poll” any time to start accepting replies again."],
  },
  {
    q: "How do I delete a poll or my data?",
    a: ["Closing a poll stops new replies but doesn’t remove it. To delete a poll for good, open your organizer page, choose “Delete poll…” in the ⋯ menu and confirm: the poll, everyone’s replies and any email addresses they left are removed. For anything else, or if you can’t open the organizer page, write to privacy@meetspan.app with the poll’s invite link and we’ll remove it."],
  },
  {
    q: "Is MeetSpan available in other languages?",
    a: ["Yes. Use the language button at the top right to switch between English and Chinese (中文). Dates and times follow the language you choose."],
  },
];

const ZH: Item[] = [
  {
    q: "MeetSpan 是什么？",
    a: ["MeetSpan 帮助身处不同时区的团队找到共同的开会时间。你创建一个排期，分享一个链接，每个人按自己的时区勾选有空的时间，MeetSpan 帮你找出大家时间重叠的地方。"],
  },
  {
    q: "需要注册账号吗？",
    a: ["不需要。创建排期和回复排期都不用注册。在“我的常用时间”页面保存每周常用时间也不需要账号（它们保存在当前浏览器里）。用 Google 登录是可选的：登录后可以在其他设备上找回自己的排期和常用时间。"],
  },
  {
    q: "怎么创建排期并邀请大家？",
    a: ["在首页填写会议名称，选择日期（具体日期或每周重复），设置时段和你的时区，然后创建排期。你会得到一个邀请链接，发给大家即可，拿到链接的人都能填写自己的时间。"],
  },
  {
    q: "邀请链接和组织者链接有什么区别？",
    a: ["邀请链接是用来分享的。私密的组织者链接是你的“钥匙”，用来查看结果并敲定最终时间。请只留给自己，千万不要发到群里。"],
  },
  {
    q: "大家怎么填写自己的时间？",
    a: ["打开邀请链接，输入名字或昵称，确认时区，然后涂选自己有空的时段。对于“可以但不理想”的时段，可以标记为“勉强可以”。"],
  },
  {
    q: "每个人看到的都是自己时区的时间吗？",
    a: ["是的。时间只存一份，每个人看到的都是自己时区的时间，包括夏令时的变化，不需要自己换算。"],
  },
  {
    q: "MeetSpan 是怎么选时间的？",
    a: ["它会寻找所有人在整个会议时长内都重叠的时段。如果找不到，会给出替代建议，比如缩短会议、把会议拆到几天里，或者不考虑某一个人，每个建议都带有具体时间。"],
  },
  {
    q: "我弄丢了组织者链接怎么办？",
    a: ["你创建的排期会保存在所用浏览器的“我的排期”里。如果创建时已经用 Google 登录，之后在任何设备上重新登录，也能在“我的排期”里找到。如果这两种办法都不行，请联系支持，并附上邀请链接（不要发组织者链接）。"],
  },
  {
    q: "谁能看到我的回复？",
    a: ["拿到邀请链接的人能看到大家填写的名字和时间，因为小组的时间重叠就是这样显示的。如果有人选择留下邮箱，只有组织者能看到。详情见隐私政策。"],
  },
  {
    q: "MeetSpan 会读取我的日历吗？",
    a: ["只有你主动选择“从 Google 日历导入”时才会。这时它只向 Google 请求你的忙闲时间，不会读取日程标题和内容，并且只在你的浏览器里用来预填你的空闲时间。"],
  },
  {
    q: "MeetSpan 会发邮件吗？",
    a: ["只会发少数几种，发件地址都是 noreply@meetspan.app：第一次连接 Google 账号时的一封欢迎邮件，以及登录 Google 后创建排期时，自动发到你 Google 邮箱的私密组织者链接。我们不发营销邮件。你回复这些邮件，我们能收到。"],
  },
  {
    q: "可以关闭排期吗？",
    a: ["可以。在你的组织者页面打开 ⋯ 菜单，选择“关闭排期”。拿到邀请链接的人仍然能看到这个排期，但不能再添加或修改自己的时间。你随时可以选择“重新开放排期”，继续接收回复。"],
  },
  {
    q: "怎么删除排期或我的数据？",
    a: ["关闭排期只是停止接收新回复，并不会删除它。要永久删除排期，请打开你的组织者页面，在 ⋯ 菜单里选择“删除排期…”并确认：排期、大家的回复和留下的邮箱都会被删除。其他情况，或者打不开组织者页面时，请发邮件到 privacy@meetspan.app，附上排期的邀请链接，我们会帮你删除。"],
  },
  {
    q: "有其他语言吗？",
    a: ["有。点右上角的语言按钮，可以在英文和中文之间切换，日期和时间的格式也会跟着变。"],
  },
];

export default function Faq() {
  const items = getLang() === "zh" ? ZH : EN;
  return (
    <div className="narrow prose">
      <h1 className="page-title">{t("Frequently asked questions")}</h1>
      <div className="faq">
        {items.map((it) => (
          <details key={it.q} className="faq-item">
            <summary>{it.q}</summary>
            {it.a.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </details>
        ))}
      </div>
      <p>
        {t("Can’t find your answer?")} <Link to="/support">{t("Contact support")}</Link>
      </p>
    </div>
  );
}
