// @vitest-environment jsdom
// The board (src/components/items/Kanban.tsx): what a screen reader is told is what happened. A refused move
// says so with the server's reason and where the card stays; an accepted one says it moved after the answer.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithClient as render } from "../admin-ui/harness";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m) } }));

import { Kanban } from "@/components/items/Kanban";
import type { Item } from "@/lib/types";

const item = (id: number, title: string, status: string): Item =>
  ({ id, project_id: "p", section: "concept/questions", title, body: "", data: {}, status, sort: id }) as unknown as Item;
const items = [item(1, "Which name ships?", "open"), item(2, "Primary channel", "open")];
const props = { items, statuses: ["open", "decided"], columns: [], onOpen: () => {} };

afterEach(() => {
  cleanup();
  toastError.mockReset();
});

const live = () => screen.getAllByRole("status").map((e) => e.textContent).join(" ");

describe("Kanban", () => {
  it("announces a move only after the server accepted it", async () => {
    let done!: () => void;
    const onMove = vi.fn(() => new Promise<void>((r) => (done = r)));
    render(<Kanban {...props} onMove={onMove} />);
    fireEvent.change(screen.getByLabelText("Move Which name ships? to a status"), { target: { value: "decided" } });
    expect(onMove).toHaveBeenCalledWith(1, "decided");
    expect(live()).toContain("Moving Which name ships? to decided.");
    expect(live()).not.toContain("moved to decided");
    done();
    await waitFor(() => expect(live()).toContain("Which name ships? moved to decided. The decided column now has 1."));
  });

  it("says a refused move was not made, with the reason and where the card stays, and shows a toast", async () => {
    const onMove = vi.fn(async () => {
      throw new Error("Decide the go/no-go first.");
    });
    render(<Kanban {...props} onMove={onMove} />);
    fireEvent.change(screen.getByLabelText("Move Primary channel to a status"), { target: { value: "decided" } });
    await waitFor(() => expect(live()).toContain("Primary channel was not moved: Decide the go/no-go first. It stays in open."));
    expect(live()).not.toContain("moved to decided.");
    expect(toastError).toHaveBeenCalledWith("Primary channel: Decide the go/no-go first.");
  });

  it("moves a focused card with Shift and the right arrow", async () => {
    const onMove = vi.fn(async () => {});
    render(<Kanban {...props} onMove={onMove} />);
    const card = screen.getByRole("article", { name: "Which name ships?, open" });
    fireEvent.keyDown(card, { key: "ArrowRight", shiftKey: true });
    expect(onMove).toHaveBeenCalledWith(1, "decided");
    await waitFor(() => expect(live()).toContain("moved to decided"));
  });

  it("has a keyboard-operable grip for each card and a readable empty-column hint", () => {
    render(<Kanban {...props} onMove={async () => {}} />);
    expect(screen.getByRole("button", { name: "Drag Which name ships?" })).toBeTruthy();
    const hint = screen.getByText("Drop an item here");
    expect(hint.className).toContain("text-secondary");
    expect(hint.className).not.toContain("text-muted");
  });
});
