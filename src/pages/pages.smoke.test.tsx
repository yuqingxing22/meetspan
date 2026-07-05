import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";
import Participate from "./Participate";
import Organizer from "./Organizer";

// Render smoke tests: mount each page (no Firebase env configured) and assert
// it renders without throwing. Effects don't run under renderToString, so no
// network calls happen — this just catches render-time crashes.
describe("page render smoke tests", () => {
  it("Home renders the create form", () => {
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(html).toContain("Schedule across timezones");
  });

  it("Participate mounts (loading or not-configured state)", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/p/abc"]}>
        <Participate />
      </MemoryRouter>
    );
    // Depending on whether a local .env configures Firebase, it shows the
    // not-configured notice, the sign-in state, or loading — all mean it mounted.
    expect(html).toMatch(/Firebase|Loading|Signing you in/);
  });

  it("Organizer mounts (loading or not-configured state)", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/o/abc?k=tok"]}>
        <Organizer />
      </MemoryRouter>
    );
    expect(html).toMatch(/Firebase|Loading|Signing you in/);
  });
});
