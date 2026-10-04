import { describe, expect, it } from "vitest";
import { cleanReport, digestEmail, errorsForDay, MAX_REPORTS_PER_DAY, scrub, storeReport } from "./errors";

/** Just enough of KVNamespace for these helpers. */
function fakeKV() {
  const m = new Map<string, string>();
  return {
    map: m,
    async get(k: string, type?: string) {
      const v = m.get(k);
      return v === undefined ? null : type === "json" ? JSON.parse(v) : v;
    },
    async put(k: string, v: string) {
      m.set(k, v);
    },
    async list({ prefix }: { prefix: string }) {
      return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
    },
  } as unknown as KVNamespace & { map: Map<string, string> };
}

const report = { message: "TypeError: x is undefined", stack: "TypeError: x\n    at f (https://meetspan.app/assets/index.js:1:200)", path: "#/o/abc123", browser: "Chrome 140", build: "index-abc" };

describe("error reports", () => {
  it("removes organizer keys, emails and poll ids", () => {
    expect(scrub("https://meetspan.app/#/o/k7q2m9?k=secret123 failed for a@b.com")).toBe(
      "https://meetspan.app/#/o/:id?k=[removed] failed for [email]"
    );
  });

  it("rejects reports without a message and trims long fields", () => {
    expect(cleanReport({})).toBeNull();
    const r = cleanReport({ ...report, message: "x".repeat(900) })!;
    expect(r.message).toHaveLength(500);
    expect(r.path).toBe("#/o/:id");
  });

  it("counts repeats of the same error as one record", async () => {
    const kv = fakeKV();
    const now = new Date("2026-10-04T10:00:00Z");
    await storeReport(kv, cleanReport(report)!, now);
    await storeReport(kv, cleanReport(report)!, now);
    await storeReport(kv, cleanReport({ ...report, message: "Another error" })!, now);
    const day = await errorsForDay(kv, "2026-10-04");
    expect(day.map((e) => [e.message, e.count])).toEqual([["TypeError: x is undefined", 2], ["Another error", 1]]);
  });

  it(`stops storing after ${MAX_REPORTS_PER_DAY} reports a day`, async () => {
    const kv = fakeKV();
    const now = new Date("2026-10-04T10:00:00Z");
    await kv.put("errtotal:2026-10-04", String(MAX_REPORTS_PER_DAY));
    expect(await storeReport(kv, cleanReport(report)!, now)).toBe(false);
  });

  it("writes a readable daily summary", async () => {
    const kv = fakeKV();
    await storeReport(kv, cleanReport(report)!, new Date("2026-10-04T10:00:00Z"));
    const mail = digestEmail("2026-10-04", await errorsForDay(kv, "2026-10-04"), false);
    expect(mail.subject).toBe("MeetSpan: 1 error on 2026-10-04 (1 report)");
    expect(mail.text).toContain("TypeError: x is undefined");
    expect(mail.html).not.toContain("<script");
  });
});
