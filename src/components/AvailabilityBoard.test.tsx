import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import AvailabilityBoard from "./AvailabilityBoard";
import type { Participant } from "../lib/types";

// Two 30-min slots on a single day (absolute epoch-ms).
const A = Date.UTC(2026, 6, 6, 16, 0); // 09:00 America/Los_Angeles
const B = Date.UTC(2026, 6, 6, 16, 30);

const participants: Participant[] = [
  { id: "p1", codename: "Ada", tz: "UTC", ownerUid: "u1", selectedSlots: [A, B], updatedAt: 1 },
  { id: "p2", codename: "Ben", tz: "UTC", ownerUid: "u2", selectedSlots: [A], updatedAt: 2 },
];

describe("AvailabilityBoard", () => {
  it("renders both panes when editable", () => {
    const html = renderToString(
      <AvailabilityBoard
        slots={[A, B]}
        tz="UTC"
        selected={new Set([A])}
        onChange={() => {}}
        editable
        participants={participants}
        myId="p3"
        nameOf={(id) => id}
      />
    );
    expect(html).toContain("Your availability");
    expect(html).toContain("Group&#x27;s availability");
  });

  it("hides the editable pane when not editable", () => {
    const html = renderToString(
      <AvailabilityBoard
        slots={[A, B]}
        tz="UTC"
        selected={new Set()}
        onChange={() => {}}
        editable={false}
        participants={participants}
        myId=""
        nameOf={(id) => id}
      />
    );
    expect(html).not.toContain("Your availability");
    expect(html).toContain("Group&#x27;s availability");
  });

  it("folds the viewer's live selection into the overlap count", () => {
    // Viewer (not yet a saved participant) is free at slot A along with Ada+Ben
    // → 3 free; the tooltip surfaces the running count and 'You'.
    const html = renderToString(
      <AvailabilityBoard
        slots={[A, B]}
        tz="UTC"
        selected={new Set([A])}
        onChange={() => {}}
        editable
        participants={participants}
        myId=""
        nameOf={(id) =>
          participants.find((p) => p.id === id)?.codename ?? id
        }
      />
    );
    expect(html).toContain("3 in so far");
    expect(html).toContain("3/3 free");
    expect(html).toContain("You");
  });

  it("does not double-count a saved viewer (stored copy replaced by live edits)", () => {
    // 'p1' is both in participants (A,B) and the viewer; live selection is only
    // A, so slot B should drop to 1 free (Ada's stored B is not re-added).
    const html = renderToString(
      <AvailabilityBoard
        slots={[A, B]}
        tz="UTC"
        selected={new Set([A])}
        onChange={() => {}}
        editable
        participants={participants}
        myId="p1"
        nameOf={(id) =>
          participants.find((p) => p.id === id)?.codename ?? id
        }
      />
    );
    // total people = Ben + me = 2. Slot A: Ben + me = 2/2. Slot B: nobody = 0/2.
    expect(html).toContain("2 in so far");
    expect(html).toContain("2/2 free");
    expect(html).toContain("0/2 free");
  });
});
