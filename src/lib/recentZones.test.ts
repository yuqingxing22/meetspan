import { describe, expect, it } from "vitest";
import { MAX_RECENT_TZS, withRecentTz } from "./recentZones";

describe("recently used timezones", () => {
  it("puts the latest pick first without duplicates", () => {
    let list = withRecentTz([], "Asia/Tokyo");
    list = withRecentTz(list, "Europe/London");
    list = withRecentTz(list, "Asia/Tokyo");
    expect(list).toEqual(["Asia/Tokyo", "Europe/London"]);
  });

  it("treats a legacy id as the same zone", () => {
    const list = withRecentTz(["Asia/Kolkata"], "Asia/Calcutta");
    expect(list).toEqual(["Asia/Calcutta"]);
  });

  it(`keeps at most ${MAX_RECENT_TZS}`, () => {
    let list: string[] = [];
    for (const tz of ["UTC", "Asia/Tokyo", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Shanghai"])
      list = withRecentTz(list, tz);
    expect(list).toHaveLength(MAX_RECENT_TZS);
    expect(list[0]).toBe("Asia/Shanghai");
  });
});
