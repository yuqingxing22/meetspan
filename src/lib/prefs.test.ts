import { describe, expect, it } from "vitest";
import { cleanPrefs } from "./prefs";

describe("cleanPrefs templates", () => {
  it("moves a template saved before there were two versions into its language", () => {
    const p = cleanPrefs({
      templates: [
        { id: "a", name: "组会", subject: "{会议}：时间确认", body: "大家好", optionsBody: "" },
        { id: "b", name: "Lab", subject: "{meeting}", body: "Hi all", optionsBody: "" },
      ],
    });
    expect(p.templates[0].zh.body).toBe("大家好");
    expect(p.templates[0].en.body).toBe("");
    expect(p.templates[1].en.body).toBe("Hi all");
    expect(p.templates[1].zh.body).toBe("");
  });

  it("keeps both versions and drops unknown built-in types", () => {
    const p = cleanPrefs({
      templates: [
        { id: "c", builtin: "team", name: "", en: { subject: "s", body: "b", optionsBody: "" }, zh: { subject: "", body: "", optionsBody: "" } },
        { id: "d", builtin: "nope", name: "x", en: { subject: "", body: "b", optionsBody: "" }, zh: {} },
      ],
    });
    expect(p.templates[0]).toMatchObject({ builtin: "team", en: { body: "b" } });
    expect(p.templates[1].builtin).toBeUndefined();
    expect(p.templates[1].zh).toEqual({ subject: "", body: "", optionsBody: "" });
  });
});
