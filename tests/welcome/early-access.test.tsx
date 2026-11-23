// @vitest-environment jsdom
// The early-access offer in the browser: the count line, the two-field form that also works as a plain form post,
// the checks before sending, the answer (place or waiting list) and the optional details sent with the token, the
// waiting-list wording at zero, the price line from the plan catalogue, axe with no violations in every placement,
// and the tracking helpers (Do Not Track respected, one section_view per visit, the data-track click convention).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import type { EarlyAccessCount } from "@/lib/accessRequests/shared";

const state = vi.hoisted(() => ({ count: { limit: 50, held: 3, left: 47, waiting: 0 } as EarlyAccessCount | null, showPrices: true }));
vi.mock("@/lib/accessRequests/places", () => ({ earlyAccessCount: async () => (state.count ? state.count : Promise.reject(new Error("down"))) }));
vi.mock("@/lib/admin/plans", async () => {
  const s = await import("@/lib/admin/planSchema");
  return { publicLevels: async () => ({ ...s.levelsOf(s.builtInCatalogue()), showPrices: state.showPrices }) };
});

import { EarlyAccess } from "@/components/welcome/early/EarlyAccess";
import { parseTrack, TrackSection, Tracker, track } from "@/components/welcome/early/track";

type Sent = { url: string; body: Record<string, unknown> };
let sent: Sent[] = [];
function serve(answer: (s: Sent) => { status?: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const s = { url: String(input), body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> };
      sent.push(s);
      const r = answer(s);
      return new Response(r.status === 204 ? null : JSON.stringify(r.body), { status: r.status ?? 200 });
    })
  );
}
const events = () => sent.filter((s) => s.url === "/api/events").map((s) => s.body.event);
const forms = () => sent.filter((s) => s.url !== "/api/events");

async function noViolations(container: HTMLElement) {
  const r = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

beforeEach(() => {
  sent = [];
  state.count = { limit: 50, held: 3, left: 47, waiting: 0 };
  state.showPrices = true;
  sessionStorage.clear();
  Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
  serve(() => ({ status: 204, body: null }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EarlyAccess", () => {
  it.each(["hero", "pricing", "close"] as const)("renders the count, the form as a plain post, the price line, and passes axe (%s)", async (placement) => {
    const { container } = render(await EarlyAccess({ placement }));
    expect(screen.getByText("47 of 50 early-access places left")).toBeTruthy();
    const form = container.querySelector("form")!;
    expect(form.getAttribute("action")).toBe("/api/access-requests");
    expect(form.getAttribute("method")).toBe("post");
    expect((container.querySelector('input[name="placement"]') as HTMLInputElement).value).toBe(placement);
    expect(screen.getByLabelText(/^Email/)).toBeTruthy();
    expect(screen.getByLabelText(/^What do you want to make\?/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Claim an early-access place" })).toBeTruthy();
    // in the pricing block the plan cards under the form carry the prices, so the line is not said twice
    expect(!!screen.queryByText("After early access: Maker $20 a month, Studio $40 a month.")).toBe(placement !== "pricing");
    // the welcome page says the privacy sentence once, in its footer; only the confirmation page's own block carries it
    expect(screen.queryByText(/counted on our own server/)).toBeNull();
    expect(!!screen.queryByText(/We open workspaces in the order places were claimed/)).toBe(placement === "close");
    await noViolations(container);
  });

  it("says the places are full and offers the waiting list at zero; with the count unreadable, shows the form without it", async () => {
    state.count = { limit: 50, held: 50, left: 0, waiting: 4 };
    render(await EarlyAccess({ placement: "pricing" }));
    expect(screen.getByText("Early access is full. Join the waiting list.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join the waiting list" })).toBeTruthy();
    cleanup();
    state.count = null;
    render(await EarlyAccess({ placement: "pricing" }));
    expect(screen.queryByText(/early-access places left/)).toBeNull();
    expect(screen.getByRole("button", { name: "Claim an early-access place" })).toBeTruthy();
  });

  it("leaves the price line out while prices are off in the catalogue", async () => {
    state.showPrices = false;
    render(await EarlyAccess({ placement: "close" }));
    expect(screen.queryByText(/After early access/)).toBeNull();
  });

  it("can be drawn several times on one page with unique field ids", async () => {
    const a = await EarlyAccess({ placement: "hero" });
    const b = await EarlyAccess({ placement: "close" });
    const { container } = render(<>{a}{b}</>);
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    await noViolations(container);
  });

  it("checks both fields before sending, announces the errors and sends nothing", async () => {
    render(await EarlyAccess({ placement: "hero" }));
    fireEvent.click(screen.getByRole("button", { name: "Claim an early-access place" }));
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent)).toEqual(["Enter your email address.", "Say in a few words what you want to make."]);
    expect(screen.getByLabelText(/^Email/).getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText(/^Email/));
    expect(forms()).toHaveLength(0);
    await waitFor(() => expect(events()).toContain("form_error"));
  });

  it("sends email and the one line, shows the place and what happens next, then the optional details with the token", async () => {
    serve((s) =>
      s.url === "/api/events"
        ? { status: 204, body: null }
        : s.url === "/api/access-requests"
          ? { status: 201, body: { ok: true, message: "You have place number 4. We open workspaces in order and write to this address.", outcome: { kind: "place", place: 4 }, token: "tok_abcdefghijklmnopqrstuvwxyz012345" } }
          : { body: { ok: true, message: "Thank you. Your details are saved with your request." } }
    );
    const { container } = render(await EarlyAccess({ placement: "close" }));
    fireEvent.focus(screen.getByLabelText(/^Email/));
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByLabelText(/^What do you want to make\?/), { target: { value: "A plant sensor" } });
    fireEvent.click(screen.getByRole("button", { name: "Claim an early-access place" }));
    expect(await screen.findByText("You have place number 4. We open workspaces in order and write to this address.")).toBeTruthy();
    expect(forms()[0]!.body).toMatchObject({ email: "ada@example.test", building: "A plant sensor", placement: "close", website: "" });
    expect(String(forms()[0]!.body.visit)).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(events()).toContain("form_start");
    await noViolations(container);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Plan you expect to use"), { target: { value: "studio" } });
    fireEvent.click(screen.getByRole("button", { name: "Save these details" }));
    expect(await screen.findByText("Thank you. Your details are saved with your request.")).toBeTruthy();
    expect(forms()[1]).toEqual({ url: "/api/access-requests/details", body: { token: "tok_abcdefghijklmnopqrstuvwxyz012345", name: "Ada", company: "", level: "studio" } });
  });

  it("shows the waiting-list position, and the server's refusal in the form", async () => {
    serve((s) => (s.url === "/api/events" ? { status: 204, body: null } : { status: 429, body: { error: "Too many requests from here. Try again in 4 seconds." } }));
    render(await EarlyAccess({ placement: "pricing" }));
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByLabelText(/^What do you want to make\?/), { target: { value: "A plant sensor" } });
    fireEvent.click(screen.getByRole("button", { name: "Claim an early-access place" }));
    expect(await screen.findByText("Too many requests from here. Try again in 4 seconds.")).toBeTruthy();
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe("ada@example.test");
    cleanup();
    serve((s) => (s.url === "/api/events" ? { status: 204, body: null } : { status: 201, body: { ok: true, message: "Early access is full. You are number 2 on the waiting list. We write to this address when a place opens.", outcome: { kind: "waiting", position: 2 }, token: "tok_abcdefghijklmnopqrstuvwxyz012345" } }));
    render(await EarlyAccess({ placement: "pricing" }));
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "bea@example.test" } });
    fireEvent.change(screen.getByLabelText(/^What do you want to make\?/), { target: { value: "A plant sensor" } });
    fireEvent.click(screen.getByRole("button", { name: "Claim an early-access place" }));
    expect(await screen.findByText(/You are number 2 on the waiting list/)).toBeTruthy();
  });
});

describe("tracking", () => {
  it("records nothing when the browser asks not to be tracked", () => {
    Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
    track("cta_click", { cta: "hero" });
    render(<Tracker />);
    expect(sent).toHaveLength(0);
  });

  it("sends page_view with the campaign tags, handles data-track clicks with their section, and reads the convention strictly", async () => {
    window.history.replaceState(null, "", "/welcome?utm_source=news&utm_campaign=launch&email=x");
    render(
      <>
        <Tracker />
        <TrackSection id="pricing">
          <button type="button" data-track="plan:maker">Maker</button>
        </TrackSection>
      </>
    );
    fireEvent.click(screen.getByRole("button", { name: "Maker" }));
    const bodies = sent.map((s) => s.body);
    expect(bodies[0]).toMatchObject({ event: "page_view", path: "/welcome", detail: { utm_source: "news", utm_campaign: "launch" } });
    expect(JSON.stringify(bodies[0])).not.toContain("email");
    expect(bodies[1]).toMatchObject({ event: "plan_click", section: "pricing", detail: { plan: "maker" } });
    expect(bodies[0]!.visit).toBe(bodies[1]!.visit);
    expect(parseTrack("cta:hero")).toEqual({ event: "cta_click", detail: { cta: "hero" } });
    expect(parseTrack("example:hero")).toEqual({ event: "example_open", detail: { from: "hero" } });
    expect(parseTrack("buy:now")).toBeNull();
    expect(parseTrack("cta:<script>")).toBeNull();
  });

  it("sends section_view once per visit, when the section is first seen", async () => {
    let fire: (v: boolean) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
          fire = (v) => cb([{ isIntersecting: v }]);
        }
        observe() {}
        disconnect() {}
      }
    );
    serve(() => ({ status: 204, body: null }));
    const ui = (
      <TrackSection id="faq">
        <p>Questions</p>
      </TrackSection>
    );
    const r = render(ui);
    act(() => fire(true));
    r.unmount();
    render(ui);
    act(() => fire(true));
    expect(sent.filter((s) => s.body.event === "section_view").map((s) => s.body.section)).toEqual(["faq"]);
  });
});

