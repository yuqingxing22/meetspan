import { describe, expect, it } from "vitest";
import { isNoise, pagePath } from "./errorReport";

describe("error reporting", () => {
  it("strips poll ids and organizer keys from the page path", () => {
    expect(pagePath("#/o/k7q2m9?k=secret&view=times")).toBe("#/o/:id");
    expect(pagePath("#/p/k7q2m9")).toBe("#/p/:id");
    expect(pagePath("#/privacy")).toBe("#/privacy");
    expect(pagePath("")).toBe("#/");
  });

  it("ignores errors we can't act on", () => {
    expect(isNoise("ResizeObserver loop completed with undelivered notifications.", "")).toBe(true);
    expect(isNoise("Script error.", "")).toBe(true);
    expect(isNoise("TypeError: x", "at chrome-extension://abc/content.js:1:1")).toBe(true);
    expect(isNoise("TypeError: x is undefined", "at f (https://meetspan.app/assets/index.js:1:2)")).toBe(false);
  });
});
