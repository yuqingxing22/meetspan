import { describe, expect, it } from "vitest";
import { parseEmails } from "./inviteEmails";

describe("parseEmails", () => {
  it("splits on commas, semicolons, spaces and new lines", () => {
    expect(parseEmails("a@b.co, c@d.org;e@f.io\ng@h.com  i@j.net").good).toEqual([
      "a@b.co",
      "c@d.org",
      "e@f.io",
      "g@h.com",
      "i@j.net",
    ]);
  });
  it("lowercases and drops repeats", () => {
    expect(parseEmails("Mei@Example.com mei@example.com").good).toEqual(["mei@example.com"]);
  });
  it("reports addresses that don't look valid", () => {
    const r = parseEmails("ok@x.com nope nope@x @y.com");
    expect(r.good).toEqual(["ok@x.com"]);
    expect(r.bad).toEqual(["nope", "nope@x", "@y.com"]);
  });
  it("handles empty input", () => {
    expect(parseEmails("  \n ")).toEqual({ good: [], bad: [] });
  });
});
