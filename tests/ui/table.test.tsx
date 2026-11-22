// @vitest-environment jsdom
// The items table on TanStack Table: sorting with aria-sort, column visibility, arrow-key movement between rows.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithClient as render } from "../admin-ui/harness";
import { ItemsTable } from "@/components/items/ItemsTable";
import type { Item } from "@/lib/types";

const item = (id: number, title: string, status: string, cost: string): Item =>
  ({ id, project_id: "p", section: "s", title, body: "", data: { cost }, status, sort: id }) as unknown as Item;
const items = [item(1, "Charger", "open", "$12"), item(2, "Battery", "open", "$9.50"), item(3, "Antenna", "decided", "$110")];
const props = { items, statuses: ["open", "decided"], columns: [{ key: "cost", label: "Cost" }], onOpen: vi.fn(), onStatus: vi.fn() };

afterEach(cleanup);
const titles = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("button")[0]!.textContent);

describe("ItemsTable", () => {
  it("keeps the section order until a sort is chosen, then sorts, reverses and clears", () => {
    render(<ItemsTable {...props} />);
    expect(titles()).toEqual(["Charger", "Battery", "Antenna"]);
    const head = screen.getByRole("columnheader", { name: /title/i });
    fireEvent.click(within(head).getByRole("button"));
    expect(head.getAttribute("aria-sort")).toBe("ascending");
    expect(titles()).toEqual(["Antenna", "Battery", "Charger"]);
    fireEvent.click(within(head).getByRole("button"));
    expect(head.getAttribute("aria-sort")).toBe("descending");
    expect(titles()).toEqual(["Charger", "Battery", "Antenna"]);
    fireEvent.click(within(head).getByRole("button"));
    expect(head.getAttribute("aria-sort")).toBe("none");
  });

  it("sorts money by value, not by text", () => {
    render(<ItemsTable {...props} />);
    fireEvent.click(within(screen.getByRole("columnheader", { name: /cost/i })).getByRole("button"));
    expect(titles()).toEqual(["Battery", "Charger", "Antenna"]);
  });

  it("moves focus down a column with the arrow keys", () => {
    render(<ItemsTable {...props} />);
    const first = screen.getAllByRole("button", { name: "Charger" })[0]!;
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("Battery");
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement?.textContent).toBe("Antenna");
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement?.textContent).toBe("Charger");
  });

  it("hides a column from the Columns menu", async () => {
    render(<ItemsTable {...props} />);
    expect(screen.getByRole("columnheader", { name: /cost/i })).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole("button", { name: /columns/i }), { button: 0, ctrlKey: false });
    const item = await screen.findByRole("menuitemcheckbox", { name: "Cost" });
    fireEvent.click(item);
    expect(screen.queryByRole("columnheader", { name: /cost/i })).toBeNull();
  });
});
