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
    a: ["No. You can create a poll and reply to one without signing up. You can even save your usual weekly times and your settings without one, under Settings (they stay in this browser). Signing in with Google is optional: it lets you find your polls, usual times and settings on other devices."],
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
    a: ["It looks for windows where everyone overlaps for the full length of the meeting. If nothing fits, it suggests alternatives such as a shorter meeting, splitting the meeting across days, or leaving out one person, each with concrete times.", "When many times work, “All times everyone can make it” groups back-to-back start times into ranges, and “Smart picks” ticks the few most comfortable ones: daytime for everyone in their own timezone, on a weekday, away from lunch, and spread over different days."],
  },
  {
    q: "I lost my organizer link. What can I do?",
    a: ["Polls you created are saved under “Your polls” in the browser you used (the menu shows the latest few; Settings → Your polls has them all). If you were signed in with Google when you created the poll, you can find it under “Your polls” on any device after signing in again. If neither works, contact support and include the invite link (never the organizer link). We can restore access only if we can confirm you created the poll, for example because you created it while signed in with Google using the email you write from."],
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
    a: ["Yes. On your organizer page, click the lock button next to the settings button and confirm. People who open the invite link can still see the poll, but they can no longer add or change their times. Click the same button again any time to reopen the poll. To close several polls at once, use Settings → Your polls."],
  },
  {
    q: "How do I delete a poll or my data?",
    a: ["Closing a poll stops new replies but doesn’t remove it. To delete a poll for good, open your organizer page, click the delete (trash) button next to the settings button and confirm by typing “delete”: the poll, everyone’s replies and any email addresses they left are removed. To delete several polls at once, use Settings → Your polls. For anything else, or if you can’t open the organizer page, write to privacy@meetspan.app with the poll’s invite link. Since anyone with that link could ask, we first check that you’re the organizer (for example, that you created the poll while signed in with Google using the email you write from). To remove only your own reply, tell us the name or email address you used."],
  },
  {
    q: "Can I change the email MeetSpan drafts?",
    a: ["Yes. Under Settings → Email templates you can edit the wording of each built-in meeting type, or add your own categories, using placeholders such as {meeting} and {times} for the details. They then appear under “Meeting type” on your poll page and in the email draft. You can restore a built-in one to its original text at any time."],
  },
  {
    q: "Is MeetSpan available in other languages?",
    a: ["Yes. Use the language button at the top right, or Settings, to switch between English and Chinese (中文). Dates and times follow the language you choose, and Settings also lets you pick a 12- or 24-hour clock."],
  },
];

const ZH: Item[] = [
  {
    q: "MeetSpan 是什么？",
    a: ["MeetSpan 帮助身处不同时区的团队找到共同的开会时间。你创建一个排期，分享一个链接，每个人按自己的时区勾选有空的时间，MeetSpan 帮你找出大家时间重叠的地方。"],
  },
  {
    q: "需要注册账号吗？",
    a: ["不需要。创建排期和回复排期都不用注册。在“设置”里保存每周常用时间和个人设置也不需要账号（它们保存在当前浏览器里）。用 Google 登录是可选的：登录后可以在其他设备上找回自己的排期、常用时间和设置。"],
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
    a: ["它会寻找所有人在整个会议时长内都重叠的时段。如果找不到，会给出替代建议，比如缩短会议、把会议拆到几天里，或者不考虑某一个人，每个建议都带有具体时间。", "如果可选的时间很多，“所有人都有空的全部时间”会把连续的开始时间合并成一段，“智能推荐”会勾出最合适的几个：按每个人自己的时区都是白天、在工作日、避开午饭，并尽量分在不同的日子。"],
  },
  {
    q: "我弄丢了组织者链接怎么办？",
    a: ["你创建的排期会保存在所用浏览器的“我的排期”里（菜单里显示最近几个，“设置 → 我的排期”里有全部）。如果创建时已经用 Google 登录，之后在任何设备上重新登录，也能在“我的排期”里找到。如果这两种办法都不行，请联系支持，并附上邀请链接（不要发组织者链接）。我们需要先确认排期是你创建的才能帮你恢复，比如你创建时用 Google 登录过，而且来信邮箱就是那个 Google 邮箱。"],
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
    a: ["可以。在你的组织者页面，点设置按钮旁边的锁形按钮并确认。拿到邀请链接的人仍然能看到这个排期，但不能再添加或修改自己的时间。之后随时再点同一个按钮，就能重新开放排期。想一次关闭多个排期，可以用“设置 → 我的排期”。"],
  },
  {
    q: "怎么删除排期或我的数据？",
    a: ["关闭排期只是停止接收新回复，并不会删除它。要永久删除排期，请打开你的组织者页面，点设置按钮旁边的删除（垃圾桶）按钮，输入“删除”确认：排期、大家的回复和留下的邮箱都会被删除。想一次删除多个排期，可以用“设置 → 我的排期”。其他情况，或者打不开组织者页面时，请发邮件到 privacy@meetspan.app，附上排期的邀请链接。因为拿到这个链接的人都可以来信，我们会先确认你是组织者（比如你创建时用 Google 登录过，而且来信邮箱就是那个 Google 邮箱）。如果只想删除自己填的回复，告诉我们你当时用的名字或邮箱即可。"],
  },
  {
    q: "可以修改 MeetSpan 起草的邮件吗？",
    a: ["可以。在“设置 → 邮件模板”里，你可以修改每种内置会议类型的措辞，也可以新建自己的类别，用 {会议}、{时间} 这样的占位符代替具体内容。之后它们会出现在排期页的“会议类型”和起草邮件的模板列表里。改过的内置类型随时可以恢复原样。"],
  },
  {
    q: "有其他语言吗？",
    a: ["有。点右上角的语言按钮，或者在“设置”里，可以在英文和中文之间切换，日期和时间的格式也会跟着变。“设置”里还可以选择 12 小时制或 24 小时制。"],
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
