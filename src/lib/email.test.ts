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
