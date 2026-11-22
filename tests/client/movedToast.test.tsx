// @vitest-environment jsdom
// Process review 3: dropping a card on another status says so in a toast that offers "Add a reason".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Toaster } from "@/components/ui/sonner";
import { announceMove } from "@/components/trace/movedToast";

const calls: { path: string; body: unknown }[] = [];
beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(input), body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the moved toast", () => {
  it("names the card and the new status, and saves a reason against the row", async () => {
    render(<Toaster />);
    act(() => announceMove({ id: 7, title: "Order the board" }, "done"));
    const toast = await screen.findByTestId("moved-toast");
    expect(toast.textContent).toContain("Order the board");
    expect(toast.textContent).toContain("done");
    fireEvent.click(screen.getByRole("button", { name: "Add a reason" }));
    fireEvent.change(screen.getByLabelText("Why (kept in the history)"), { target: { value: "Supplier confirmed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls).toEqual([{ path: "/api/items/7/reason", body: { why: "Supplier confirmed" } }]));
  });

  it("is only an offer: nothing is sent unless a reason is saved", async () => {
    render(<Toaster />);
    act(() => announceMove({ id: 8, title: "Another card" }, "blocked"));
    await screen.findByTestId("moved-toast");
    expect(calls).toHaveLength(0);
  });

  it("asks for the reason before it sends one", async () => {
    render(<Toaster />);
    act(() => announceMove({ id: 9, title: "Third card" }, "done"));
    // Toasts from the tests above can still be on screen: work inside this one.
    await waitFor(() => expect(screen.getAllByTestId("moved-toast").some((t) => t.textContent?.includes("Third card"))).toBe(true));
    const mine = within(screen.getAllByTestId("moved-toast").find((t) => t.textContent?.includes("Third card"))!);
    fireEvent.click(mine.getByRole("button", { name: "Add a reason" }));
    fireEvent.click(mine.getByRole("button", { name: "Save" }));
    expect((await mine.findByRole("alert")).textContent).toBe("Type the reason.");
    expect(mine.getByLabelText("Why (kept in the history)").getAttribute("aria-invalid")).toBe("true");
    expect(calls).toHaveLength(0);
  });
});
