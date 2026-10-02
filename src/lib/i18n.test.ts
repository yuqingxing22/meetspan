import { afterEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { joinNames, setLang, t } from "./i18n";

afterEach(() => setLang("en"));

describe("i18n", () => {
  it("returns English by default and fills placeholders", () => {
    expect(t("{n} free", { n: 3 })).toBe("3 free");
  });

  it("translates to Chinese and falls back to English for unknown text", () => {
    setLang("zh");
    expect(t("{n} free", { n: 3 })).toBe("3 人有空");
    expect(t("Not a real key")).toBe("Not a real key");
  });

  it("formats dates in Chinese order with a 24-hour clock", () => {
    const dt = DateTime.fromISO("2026-10-14T17:30", { zone: "America/Los_Angeles" });
    expect(dt.toFormat("ccc, LLL d · h:mm a")).toBe("Wed, Oct 14 · 5:30 PM");
    setLang("zh");
    expect(dt.toFormat("ccc, LLL d · h:mm a")).toBe("10月14日 周三 · 17:30");
    // Machine formats are never localized.
    expect(dt.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'")).toBe("20261015T003000Z");
  });

  it("joins names per language", () => {
    expect(joinNames(["Alex", "Mei", "Sam"])).toBe("Alex, Mei and Sam");
    setLang("zh");
    expect(joinNames(["Alex", "Mei", "Sam"])).toBe("Alex、Mei和Sam");
  });
});
