import { describe, expect, it } from "vitest";
import { escapeHtml, fromFsFields, isEmail, isInactive, retentionCutoff, sha256Hex } from "./logic";
import { inviteEmail, organizerLinkEmail, welcomeEmail } from "./templates";

describe("isEmail", () => {
  it("accepts normal addresses and rejects junk", () => {
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail("a b@c.com")).toBe(false);
    expect(isEmail("a@b.com,c@d.com")).toBe(false);
  });
});

describe("fromFsFields", () => {
  it("decodes Firestore REST values", () => {
    expect(
      fromFsFields({
        title: { stringValue: "Sync" },
        n: { integerValue: "3" },
        expected: { arrayValue: { values: [{ stringValue: "Mei" }] } },
        nested: { mapValue: { fields: { ok: { booleanValue: true } } } },
        none: { nullValue: null },
      })
    ).toEqual({ title: "Sync", n: 3, expected: ["Mei"], nested: { ok: true }, none: null });
  });
  it("treats a missing array as empty", () => {
    expect(fromFsFields({ a: { arrayValue: {} } })).toEqual({ a: [] });
  });
});

describe("templates", () => {
  it("escapes user-controlled text in every email", () => {
    const evil = `<img src=x onerror=alert(1)>`;
    const mails = [
      inviteEmail("en", { organizerName: evil, title: evil, url: "https://meetspan.app/#/p/x", deadline: evil }),
      inviteEmail("zh", { organizerName: evil, title: evil, url: "https://meetspan.app/#/p/x" }),
      organizerLinkEmail("en", { title: evil, organizerUrl: "https://meetspan.app/#/o/x?k=y", inviteUrl: "https://meetspan.app/#/p/x" }),
      organizerLinkEmail("zh", { title: evil, organizerUrl: "https://meetspan.app/#/o/x?k=y", inviteUrl: "https://meetspan.app/#/p/x" }),
      welcomeEmail("en", "https://meetspan.app", evil),
    ];
    for (const m of mails) {
      expect(m.html).not.toContain("<img src=x");
      expect(m.html).toContain("&lt;img");
    }
  });
  it("escapeHtml covers the dangerous characters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("retention", () => {
  const now = Date.UTC(2026, 9, 2);
  const cutoff = retentionCutoff(now);
  it("puts the cutoff 12 months back", () => {
    expect(cutoff).toBe(Date.UTC(2025, 9, 2));
  });
  it("keeps a poll with any recent activity", () => {
    const old = cutoff - 1000;
    expect(isInactive(cutoff, { createdAt: old }, [old])).toBe(true);
    expect(isInactive(cutoff, { createdAt: old }, [old, cutoff + 1])).toBe(false); // recent reply
    expect(isInactive(cutoff, { createdAt: old, lastActivityAt: cutoff + 1 }, [])).toBe(false); // organizer edit
    expect(isInactive(cutoff, { createdAt: cutoff + 1 }, [])).toBe(false); // new poll
  });
  it("never deletes when there are no usable timestamps", () => {
    expect(isInactive(cutoff, {}, [undefined, "x"])).toBe(false);
  });
  it("ignores junk values and the exact cutoff counts as recent", () => {
    expect(isInactive(cutoff, { createdAt: cutoff }, [])).toBe(false);
    expect(isInactive(cutoff, { createdAt: cutoff - 1 }, ["bad", null])).toBe(true);
  });
});

describe("email header", () => {
  it("shows the MeetSpan logo from the website", () => {
    const m = welcomeEmail("en", "https://meetspan.app", "Mei");
    expect(m.html).toContain("https://meetspan.app/email-logo.png");
    expect(m.html).toContain("MeetSpan</td>");
  });
});

describe("organizer link email", () => {
  it("contains both links in html and text, in both languages", () => {
    for (const lang of ["en", "zh"] as const) {
      const m = organizerLinkEmail(lang, { title: "Sync", organizerUrl: "https://meetspan.app/#/o/abc?k=sec", inviteUrl: "https://meetspan.app/#/p/abc" });
      expect(m.subject).toContain("Sync");
      for (const body of [m.html, m.text]) {
        expect(body).toContain("https://meetspan.app/#/o/abc?k=sec");
        expect(body).toContain("https://meetspan.app/#/p/abc");
      }
    }
  });
});

describe("sha256Hex", () => {
  it("matches the known digest of 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
