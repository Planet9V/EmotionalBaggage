// @vitest-environment jsdom
// U9: parts on the layout canvas can be selected by keyboard: a list of buttons that selects one and hands focus
// to the layout, where the arrow keys nudge it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlacedParts } from "@/components/layout/PlacedParts";

afterEach(cleanup);

describe("Placed parts", () => {
  it("selects a part and moves focus to the layout", async () => {
    const onSelect = vi.fn();
    render(
      <div id="layout-workspace" tabIndex={0}>
        <PlacedParts parts={[{ id: 1, label: "U1" }, { id: 2, label: "BT1" }]} selectedId={1} onSelect={onSelect} />
      </div>,
    );
    expect(screen.getByRole("button", { name: "U1" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "BT1" }));
    expect(onSelect).toHaveBeenCalledWith(2);
    await waitFor(() => expect(document.activeElement?.id).toBe("layout-workspace"));
  });
});
