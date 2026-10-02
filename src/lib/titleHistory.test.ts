import { describe, expect, it } from "vitest";
import { MAX_AGE_DAYS, MAX_TITLES, pruneTitles, withTitle } from "./titleHistory";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 2);

describe("recent meeting names", () => {
  it("puts the newest name first and ignores blanks", () => {
    let list = withTitle([], "Lab sync", NOW - 2 * DAY);
    list = withTitle(list, "Advisor 1:1", NOW - DAY);
    list = withTitle(list, "   ", NOW);
    expect(list.map((x) => x.title)).toEqual(["Advisor 1:1", "Lab sync"]);
  });

  it("moves a reused name to the top instead of duplicating it", () => {
    let list = withTitle([], "Lab sync", NOW - 2 * DAY);
    list = withTitle(list, "Advisor 1:1", NOW - DAY);
    list = withTitle(list, "lab sync ", NOW);
    expect(list.map((x) => x.title)).toEqual(["lab sync", "Advisor 1:1"]);
  });

  it(`keeps at most ${MAX_TITLES} names`, () => {
    let list: ReturnType<typeof withTitle> = [];
    for (let i = 0; i < MAX_TITLES + 3; i++) list = withTitle(list, `Meeting ${i}`, NOW - (20 - i) * 1000);
    expect(list).toHaveLength(MAX_TITLES);
    expect(list[0].title).toBe(`Meeting ${MAX_TITLES + 2}`);
  });

  it(`forgets names unused for ${MAX_AGE_DAYS} days`, () => {
    const list = [
      { title: "Old", usedAt: NOW - MAX_AGE_DAYS * DAY - 1 },
      { title: "Recent", usedAt: NOW - 10 * DAY },
    ];
    expect(pruneTitles(list, NOW).map((x) => x.title)).toEqual(["Recent"]);
  });
});
