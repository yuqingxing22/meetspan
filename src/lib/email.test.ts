import { describe, expect, it } from "vitest";
import { gmailLink, mailtoLink, outlookLink } from "./email";

const email = { subject: "Sync — proposed time", body: "Hi all,\n\nMeeting: Sync" };

describe("email compose links", () => {
  it("mailto encodes spaces as %20 (not +) so clients don't show literal pluses", () => {
    const url = mailtoLink(email);
    expect(url.startsWith("mailto:?")).toBe(true);
    expect(url).toContain("subject=Sync%20%E2%80%94%20proposed%20time");
    expect(url).toContain("%0A"); // newlines preserved
    expect(url).not.toContain("+"); // no "+"-as-space encoding
  });

  it("builds a Gmail compose URL with subject + body", () => {
    const url = gmailLink(email);
    expect(url.startsWith("https://mail.google.com/mail/?")).toBe(true);
    expect(url).toContain("view=cm");
    expect(url).toContain("su=Sync%20%E2%80%94%20proposed%20time");
    expect(url).toContain("body=Hi%20all%2C%0A");
  });

  it("builds an Outlook web compose URL", () => {
    const url = outlookLink(email);
    expect(url.startsWith("https://outlook.office.com/mail/deeplink/compose?")).toBe(
      true
    );
    expect(url).toContain("subject=Sync%20%E2%80%94%20proposed%20time");
  });

  it("prefills recipients when emails are provided", () => {
    const to = "ada@x.com,ben@y.com";
    expect(mailtoLink(email, to).startsWith("mailto:ada@x.com,ben@y.com?")).toBe(
      true
    );
    expect(gmailLink(email, to)).toContain("to=ada%40x.com%2Cben%40y.com");
    expect(outlookLink(email, to)).toContain("to=ada%40x.com%2Cben%40y.com");
  });
});

describe("generateEmail languages", () => {
  const meta = {
    title: "Sync",
    organizerName: "Kyra",
    organizerTz: "America/Los_Angeles",
  } as unknown as import("./types").PollMeta;
  const start = Date.UTC(2026, 9, 14, 16, 0);
  const sessions = [
    { startMs: start, endMs: start + 3600_000, slotCount: 2, count: 1, freeIds: ["k"], missing: [], blockId: 0 },
  ];
  const participants = [
    { id: "k", codename: "Kyra", tz: "America/Los_Angeles", ownerUid: "u", selectedSlots: [], updatedAt: 0 },
  ];
  const base = { meta, meetingName: "Sync", durationMin: 60, sessionsPerWeek: 1, type: "team" as const, sessions, participants };

  it("writes a Chinese email with Chinese dates", async () => {
    const { generateEmail } = await import("./email");
    const e = generateEmail({ ...base, lang: "zh" });
    expect(e.subject).toBe("Sync：拟定时间（团队例会）");
    expect(e.body).toContain("大家好，");
    expect(e.body).toContain("时间：10月14日 周三 · 9:00 – 10:00");
  });

  it("keeps English dates in an English email", async () => {
    const { generateEmail } = await import("./email");
    const e = generateEmail({ ...base, lang: "en" });
    expect(e.body).toContain("Hi all,");
    expect(e.body).toContain("Time: Wed, Oct 14 · 9:00 AM – 10:00 AM");
  });
});

describe("Chinese one-on-one email tone", () => {
  it("stays polite and neutral in both directions", async () => {
    const { generateEmail } = await import("./email");
    const start = Date.UTC(2026, 9, 14, 16, 0);
    const e = generateEmail({
      meta: { title: "Meeting", organizerName: "老王", organizerTz: "America/Los_Angeles" } as unknown as import("./types").PollMeta,
      meetingName: "Meeting",
      durationMin: 30,
      sessionsPerWeek: 1,
      type: "one_on_one",
      sessions: [{ startMs: start, endMs: start + 1800_000, slotCount: 1, count: 1, freeIds: [], missing: [], blockId: 0 }],
      participants: [],
      lang: "zh",
    });
    expect(e.body.startsWith("您好，")).toBe(true);
    expect(e.body).not.toContain("我们俩");
    expect(e.body).not.toContain("聊聊");
    expect(e.body.trimEnd().endsWith("如时间有变，请随时告知。谢谢！\n老王")).toBe(true);
  });
});

describe("generateEmail options", () => {
  const meta = {
    title: "Sync",
    organizerName: "Kyra",
    organizerTz: "America/Los_Angeles",
    dateMode: "weekly",
  } as unknown as import("./types").PollMeta;
  const start = Date.UTC(2026, 9, 14, 16, 0);
  const s = (ms: number) => ({ startMs: ms, endMs: ms + 3600_000, slotCount: 2, count: 1, freeIds: ["k"], missing: [], blockId: 0 });
  const sessions = [s(start), s(start + 86_400_000), s(start + 2 * 86_400_000)];
  const participants = [
    { id: "k", codename: "Kyra", tz: "America/Los_Angeles", ownerUid: "u", selectedSlots: [], updatedAt: 0 },
  ];
  const base = { meta, meetingName: "Sync", durationMin: 60, sessionsPerWeek: 1, type: "team" as const, sessions, participants, options: true };

  it("lists times as choices, not as several meetings", async () => {
    const { generateEmail } = await import("./email");
    const en = generateEmail({ ...base, lang: "en" });
    expect(en.subject).toBe("Sync — time options (Recurring team sync)");
    expect(en.body).toContain("All 3 times below work for everyone");
    expect(en.body).toContain("Option A:");
    expect(en.body).toContain("Option C:");
    expect(en.body).toContain("We'll meet once a week, 60 min each time.");
    expect(en.body).toContain("Option A: Wednesdays · 9:00 AM – 10:00 AM PDT");
    expect(en.body).toContain("Starting the week of Oct 12.");
    expect(en.body).not.toContain("Oct 14");
    expect(en.body).not.toContain("Session 1");
    const zh = generateEmail({ ...base, lang: "zh" });
    expect(zh.body).toContain("以下 3 个时间所有人都可以");
    expect(zh.body).toContain("选项 A：");
    expect(zh.body).toContain("我们每周开一次会，每次 60 分钟。");
    expect(zh.body).toContain("选项 A：每周三 · 9:00 – 10:00 PDT");
    expect(zh.body).toContain("从 10月12日 那周开始。");
    expect(zh.body).not.toContain("10月14日");
    expect(zh.body).not.toContain("第 1 次");
  });
});

describe("weekly emails show weekdays, not dates", () => {
  it("formats a confirmed weekly time with the weekday and start week", async () => {
    const { generateEmail } = await import("./email");
    const meta = { title: "Sync", organizerName: "Kyra", organizerTz: "America/Los_Angeles", dateMode: "weekly" } as unknown as import("./types").PollMeta;
    const start = Date.UTC(2026, 9, 14, 16, 0);
    const sessions = [{ startMs: start, endMs: start + 3600_000, slotCount: 2, count: 2, freeIds: ["k", "m"], missing: [], blockId: 0 }];
    const participants = [
      { id: "k", codename: "Kyra", tz: "America/Los_Angeles", ownerUid: "u", selectedSlots: [], updatedAt: 0 },
      { id: "m", codename: "Mei", tz: "Asia/Shanghai", ownerUid: "v", selectedSlots: [], updatedAt: 0 },
    ];
    const zh = generateEmail({ meta, meetingName: "Sync", durationMin: 60, sessionsPerWeek: 1, type: "team", sessions, participants, lang: "zh" });
    expect(zh.body).toContain("Mei — 每周四 · 0:00 – 1:00");
    expect(zh.body).toContain("从 10月12日 那周开始。");
    expect(zh.body).not.toContain("10月14日");
    // LA leaves daylight time in November, Shanghai doesn't.
    expect(zh.body).toContain("夏令时切换后");
  });
});
