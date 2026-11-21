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
