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
