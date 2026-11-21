// @vitest-environment jsdom
// U10: "Add option" focuses the new option's label, so typed text lands in it, and a decision whose options
// are all blank is refused with a plain sentence.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DecisionEditor } from "@/components/decisions/DecisionEditor";
import { buildTree } from "@/components/decisions/model";
import { shimBrowser } from "../admin-ui/harness";

beforeEach(shimBrowser);
afterEach(cleanup);

function renderEditor(onSave = vi.fn(async () => {})) {
  const byKey = new Map();
  render(<DecisionEditor open onOpenChange={() => {}} editing={null} defaultParent="" all={[]} byKey={byKey} tree={buildTree([], byKey)} onSave={onSave} onDelete={async () => {}} />);
  return onSave;
}

describe("the decision dialog", () => {
  it("focuses the new option's label", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Add option/ }));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Option 1 label"));
    fireEvent.click(screen.getByRole("button", { name: /Add option/ }));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Option 2 label"));
  });

  it("refuses to save a decision whose options are all blank", async () => {
    const onSave = renderEditor();
    fireEvent.change(screen.getByPlaceholderText("What has to be decided?"), { target: { value: "Which battery?" } });
    fireEvent.click(screen.getByRole("button", { name: /Add option/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Add decision$/ }));
    expect(await screen.findByText(/Every option is blank/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
});
