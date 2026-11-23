// @vitest-environment jsdom
// The early-access blocks share one count and one answer (src/components/welcome/early/places.ts): after one form
// claims a place, every count line shows the new reading and the other forms say "You have place number N" instead
// of offering the form again; the count is read again when the tab regains focus, at most once in ten seconds; the
// answer outlives a reload in the same tab and "Use another address" brings the form back; axe passes in each state.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import type { EarlyAccessCount, PublicPlaces } from "@/lib/accessRequests/shared";

const state = vi.hoisted(() => ({ count: { limit: 50, held: 3, left: 47, waiting: 0 } as EarlyAccessCount }));
vi.mock("@/lib/accessRequests/places", () => ({ earlyAccessCount: async () => state.count }));
vi.mock("@/lib/admin/plans", async () => {
  const s = await import("@/lib/admin/planSchema");
  return { publicLevels: async () => ({ ...s.levelsOf(s.builtInCatalogue()), showPrices: true }) };
});

let reads = 0;
let server: PublicPlaces = { left: 47, limit: 50, full: false };
const PLACE = { ok: true, message: "You have place number 4. We open workspaces in order and write to this address.", outcome: { kind: "place", place: 4 }, token: "tok_abcdefghijklmnopqrstuvwxyz012345" };

async function page() {
  // a fresh module graph per test: the store lives in module memory, as it does in one page
  vi.resetModules();
  const { EarlyAccess } = await import("@/components/welcome/early/EarlyAccess");
  const blocks = await Promise.all((["hero", "pricing", "close"] as const).map((placement) => EarlyAccess({ placement })));
  return render(<>{blocks}</>);
}
const block = (p: string) => document.getElementById(`early-access-${p}`)!;

async function noViolations(container: HTMLElement) {
  const r = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

beforeEach(() => {
  reads = 0;
  server = { left: 47, limit: 50, full: false };
  state.count = { limit: 50, held: 3, left: 47, waiting: 0 };
  sessionStorage.clear();
  Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/access-requests/count") {
        reads++;
        return new Response(JSON.stringify(server), { status: 200 });
      }
      if (url === "/api/access-requests") return new Response(JSON.stringify(PLACE), { status: 201 });
      return new Response(null, { status: 204 });
    })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the early-access blocks on one page", () => {
  it("after one form claims a place, every count line shows the new count and the other forms say so in one line", async () => {
    const { container } = await page();
    expect(screen.getAllByText("47 of 50 early-access places left")).toHaveLength(3);
    server = { left: 46, limit: 50, full: false };
    const close = within(block("close"));
    fireEvent.change(close.getByLabelText(/^Email/), { target: { value: "ada@example.test" } });
    fireEvent.change(close.getByLabelText(/^What do you want to make\?/), { target: { value: "A plant sensor" } });
    fireEvent.click(close.getByRole("button", { name: "Claim an early-access place" }));
    expect(await close.findByText(PLACE.message)).toBeTruthy();
    // the count is read again, fresh, once
    await waitFor(() => expect(screen.getAllByText("46 of 50 early-access places left")).toHaveLength(3));
    expect(reads).toBe(1);
    for (const p of ["hero", "pricing"]) {
      const b = within(block(p));
      expect(b.getByText("You have place number 4.")).toBeTruthy();
      expect(b.queryByRole("button", { name: "Claim an early-access place" })).toBeNull();
      expect(block(p).querySelector("form")).toBeNull();
    }
    // the answering block keeps its own full answer and the optional details
    expect(close.getByText("Tell us a little more")).toBeTruthy();
    await noViolations(container);
  });

  it("keeps the answer through a reload in the same tab; 'Use another address' offers the forms again", async () => {
    sessionStorage.setItem("c2r_early", JSON.stringify({ kind: "waiting", position: 2 }));
    const { container } = await page();
    expect(await screen.findAllByText("You are number 2 on the waiting list.")).toHaveLength(3);
    expect(container.querySelector("form")).toBeNull();
    await noViolations(container);
    fireEvent.click(within(block("hero")).getByRole("button", { name: "Use another address" }));
    await waitFor(() => expect(container.querySelectorAll("form")).toHaveLength(3));
    expect(sessionStorage.getItem("c2r_early")).toBeNull();
  });

  it("ignores a stored answer it cannot read", async () => {
    sessionStorage.setItem("c2r_early", '{"kind":"place","place":"x"}');
    const { container } = await page();
    expect(container.querySelectorAll("form")).toHaveLength(3);
  });

  it("reads the count again when the tab regains focus, at most once in ten seconds, and offers the waiting list once full", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    await page();
    // focus straight after the page was drawn: the drawn count is fresh enough
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(reads).toBe(0);
    now += 11_000;
    server = { left: 0, limit: 50, full: true };
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(screen.getAllByText("Early access is full. Join the waiting list.")).toHaveLength(3));
    expect(screen.getAllByRole("button", { name: "Join the waiting list" })).toHaveLength(3);
    expect(document.querySelectorAll('[data-early-count="0"]')).toHaveLength(3);
    now += 2_000;
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(reads).toBe(1);
  });

  it("keeps the drawn count when a reading fails or is not a count", async () => {
    await page();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ left: 1, limit: 50, full: false, held: 49 }).replace('"left":1', '"left":"1"'), { status: 200 })));
    vi.spyOn(Date, "now").mockImplementation(() => 9_999_999_999);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getAllByText("47 of 50 early-access places left")).toHaveLength(3);
  });
});
