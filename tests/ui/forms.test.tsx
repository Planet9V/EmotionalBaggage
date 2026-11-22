// @vitest-environment jsdom
// Forms on react-hook-form with a zod resolver: every invalid field says why beside itself, focus goes to the
// first one, nothing is sent while a field is invalid, and a refusal from the server stays on the form.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BatchDialog } from "@/components/production/BatchDialog";
import { ComplianceDialog } from "@/components/compliance/ComplianceDialog";
import { CostLineDialog } from "@/components/economics/CostLineDialog";
import { FirstConnection } from "@/components/schematic/FirstConnection";
import type { Part } from "@/components/schematic/model";
import { PinDialog } from "@/components/schematic/PinDialog";
import { AddItemDialog } from "@/components/items/AddItemDialog";

afterEach(cleanup);

describe("BatchDialog", () => {
  it("shows each problem beside its field and sends nothing until valid", async () => {
    const onSave = vi.fn(async () => {});
    render(<BatchDialog open onOpenChange={() => {}} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Give the batch a name.")).toBeTruthy());
    expect(screen.getByText("Units: enter a whole number of at least 1.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Run 1" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "1,200" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ title: "Run 1", status: "planned", data: { units: 1200, targetDate: "", build: "" } }));
  });

  it("keeps the form open and shows the server's reason when the save is refused", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("A shipped batch needs a date.");
    });
    render(<BatchDialog open onOpenChange={() => {}} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Run 1" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("A shipped batch needs a date.")).toBeTruthy());
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Run 1");
  });
});

describe("ComplianceDialog", () => {
  it("refuses an evidence address that is not a public web address", async () => {
    const onSave = vi.fn(async () => {});
    render(<ComplianceDialog open onOpenChange={() => {}} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "FCC Part 15" } });
    fireEvent.change(screen.getByLabelText(/Evidence web address/), { target: { value: "ftp://x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText(/enter a public web address/)).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("CostLineDialog", () => {
  it("checks the fields of the chosen kind of cost", async () => {
    const onSave = vi.fn(async () => {});
    render(<CostLineDialog open onOpenChange={() => {}} productType="electronics" currency="EUR" onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Kind of cost"), { target: { value: "scrap" } });
    fireEvent.change(await screen.findByLabelText(/Scrap allowance/), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Scrap allowance (%): cannot be more than 100.")).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Scrap allowance/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ data: { kind: "scrap", percent: 5 } })));
  });
});

describe("FirstConnection", () => {
  const part = (id: number, ref: string): Part => ({ item: { id } as never, ref, title: ref } as unknown as Part);
  it("needs a pin at both ends, then sends the wire", async () => {
    const onSave = vi.fn(async () => {});
    render(<FirstConnection parts={[part(1, "P1"), part(2, "P2")]} nextOrder={1} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Add first connection/ }));
    await waitFor(() => expect(screen.getByText("Type the pin name at both ends.")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("From pin"), { target: { value: "GND" } });
    fireEvent.change(screen.getByLabelText("To pin"), { target: { value: "GND" } });
    fireEvent.click(screen.getByRole("button", { name: /Add first connection/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ from: "P1", to: "P2", fromPin: "GND", toPin: "GND" })));
  });
});

describe("PinDialog", () => {
  it("says why beside the pin name, and sends the trimmed name once it is new", async () => {
    const onSave = vi.fn(async () => {});
    const onClose = vi.fn();
    render(<PinDialog title="Add pin" description="Name the pin." existing={["GND"]} submitLabel="Add pin" onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Add pin" }));
    await waitFor(() => expect(screen.getByText("Type a pin name, as printed on the board or in the datasheet.")).toBeTruthy());
    expect(screen.getByLabelText("Pin name").getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(screen.getByLabelText("Pin name"), { target: { value: " GND " } });
    fireEvent.click(screen.getByRole("button", { name: "Add pin" }));
    await waitFor(() => expect(screen.getByText("This part already has a pin called GND.")).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Pin name"), { target: { value: " GPIO5 " } });
    fireEvent.click(screen.getByRole("button", { name: "Add pin" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("GPIO5"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps the dialog open with the server's reason when the save is refused", async () => {
    const onClose = vi.fn();
    render(<PinDialog title="Add pin" description="Name the pin." existing={[]} submitLabel="Add pin" onClose={onClose} onSave={async () => { throw new Error("The part is gone."); }} />);
    fireEvent.change(screen.getByLabelText("Pin name"), { target: { value: "VCC" } });
    fireEvent.click(screen.getByRole("button", { name: "Add pin" }));
    await waitFor(() => expect(screen.getByText("The part is gone.")).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("AddItemDialog", () => {
  it("needs a title, then sends the row trimmed with only the columns that were filled in", async () => {
    const onCreate = vi.fn(async () => {});
    render(<AddItemDialog open onOpenChange={() => {}} label="Add a supplier" sectionLabel="Suppliers" columns={[{ key: "url", label: "Web address" }, { key: "location", label: "Location" }]} statuses={["candidate", "approved"]} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.getByText("Give it a title.")).toBeTruthy());
    expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBe("true");
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  Acme  " } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: " Leeds " } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "approved" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ title: "Acme", body: "", status: "approved", data: { location: "Leeds" } }));
  });
});

