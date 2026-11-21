// @vitest-environment jsdom
// D14: a part's opening and a board's mounting holes are set in a form, not by typing field names into the row.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PartOpeningEditor } from "@/components/enclosure/PartOpeningEditor";
import type { Item } from "@/lib/types";

afterEach(() => cleanup());
const item = (data: Record<string, unknown>): Item => ({ id: 4, projectId: "p", section: "design/bom", title: "Carrier board", body: "", status: "to buy", sort: 1, data: { ref: "PCB1", ...data } });

describe("the part's enclosure settings", () => {
  it("saves an opening set by hand and the board's own holes", async () => {
    const onSave = vi.fn(async () => {});
    render(<PartOpeningEditor item={item({})} isBoard onSave={onSave} />);
    fireEvent.click(screen.getByLabelText("Set here"));
    fireEvent.change(screen.getByLabelText("Wall"), { target: { value: "front" } });
    fireEvent.change(screen.getByLabelText("Width or diameter (mm)"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Height (mm)"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Shift along the wall (mm)"), { target: { value: "-3" } });
    fireEvent.click(screen.getByLabelText("The board's own holes"));
    fireEvent.click(screen.getByRole("button", { name: "Add a hole" }));
    fireEvent.change(screen.getByLabelText("Hole 1 x"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Hole 1 z"), { target: { value: "-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Save these settings" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect((onSave.mock.calls[0] as unknown[])[0]).toEqual({ opening: { face: "front", shape: "rect", width: 12, height: 7, shift: [-3, 0] }, mountingHoles: [{ x: 30, z: -20 }] });
  });

  it("no opening, and back to the worked-out one, clear the setting", async () => {
    const onSave = vi.fn(async () => {});
    render(<PartOpeningEditor item={item({ opening: { face: "left" } })} isBoard={false} onSave={onSave} />);
    expect((screen.getByLabelText("Set here") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("No opening"));
    fireEvent.click(screen.getByRole("button", { name: "Save these settings" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ opening: { off: true } }));
    expect(screen.queryByText("Mounting holes")).toBeNull();
  });
});
