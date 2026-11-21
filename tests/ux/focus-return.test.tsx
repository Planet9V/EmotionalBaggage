// @vitest-environment jsdom
// U6: focus goes back to the opener when any dialog closes (Escape or Save), and to a named element (the new
// row after a create) when the caller gives one. Before the fix it stayed on the page body.
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Modal } from "@/components/ui/modal";
import { shimBrowser } from "../admin-ui/harness";

beforeEach(shimBrowser);
afterEach(cleanup);

function Opener({ named }: { named?: boolean }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<string[]>([]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Add row</button>
      <ul>{rows.map((r) => <li key={r}><button type="button" data-row-id={r}>{r}</button></li>)}</ul>
      <Modal open={open} onOpenChange={setOpen} title="New row" returnFocus={named ? () => document.querySelector<HTMLElement>('[data-row-id="r1"]') : undefined}>
        {/* autoFocus takes focus before Radix's open event: the opener must still be known */}
        <input aria-label="Title" autoFocus />
        <button type="button" onClick={() => { setRows(["r1"]); setOpen(false); }}>Save</button>
      </Modal>
    </>
  );
}

describe("focus after a dialog closes", () => {
  it("returns to the opener after Escape", async () => {
    render(<Opener />);
    const add = screen.getByRole("button", { name: "Add row" });
    add.focus();
    fireEvent.click(add);
    await screen.findByRole("dialog");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(add));
  });

  it("goes to the new row after a create", async () => {
    render(<Opener named />);
    const add = screen.getByRole("button", { name: "Add row" });
    add.focus();
    fireEvent.click(add);
    await screen.findByRole("dialog");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    await waitFor(() => expect(document.activeElement?.getAttribute("data-row-id")).toBe("r1"));
  });
});
