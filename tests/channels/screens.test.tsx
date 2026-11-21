// @vitest-environment jsdom
// The send confirmation (src/components/channels/shared.tsx) against a fetch stand-in: it shows the
// exact text, the cost with its date, every reason it cannot be sent, keeps the button off until it can,
// sends the hash of the text it showed, records the cost tick, and shows the server's refusal.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { SendDialog } from "@/components/channels/shared";
import { X_COST_STATEMENT } from "@/lib/channels/xCost";
import type { Preview } from "@/lib/channels/send";
import { adminServer, on, renderWithClient, shimBrowser } from "../admin-ui/harness";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const P = "p1";
const preview = (o: Partial<Preview> = {}): Preview => ({
  kind: "post",
  itemId: 7,
  channel: "x",
  text: "MK1 ships in March.",
  textSha256: "f".repeat(64),
  status: "approved",
  sendable: true,
  blocked: "",
  account: "@baggageclaims",
  cost: { usd: 0.015, rule: "Post: Create", statementVersion: X_COST_STATEMENT.version, read: X_COST_STATEMENT.read, url: X_COST_STATEMENT.url, acknowledged: true },
  imageUrl: null,
  imageProblem: null,
  media: [],
  replyTo: null,
  ...o,
});
const status = (ack: boolean) => ({ note: "", amazon: null, x: { configured: true, clientSaved: true, account: "@baggageclaims", statement: X_COST_STATEMENT, acknowledged: ack ? { by: "demo", at: "2026-11-21T10:00:00Z" } : null }, instagram: { configured: false, review: { ticks: {}, updatedAt: null } } });

describe("SendDialog", () => {
  it("is blocked until the cost statement is read, records the tick, then sends the hash it showed", async () => {
    let acked = false;
    const srv = adminServer([
      on("GET", "/api/channels/send/preview", () => ({ body: acked ? preview() : preview({ sendable: false, blocked: "Read X's cost statement and tick that you have read it first.", cost: { ...preview().cost!, acknowledged: false } }) }), true),
      on("GET", "/api/channels/status", () => ({ body: status(acked) }), true),
      on("POST", "/api/channels/x/ack", () => {
        acked = true;
        return { body: { version: X_COST_STATEMENT.version } };
      }),
      on("POST", "/api/channels/send", () => ({ body: { ok: true, id: "190000", url: "https://x.com/i/web/status/190000", item: {} } })),
    ]);
    renderWithClient(<SendDialog projectId={P} kind="post" itemId={7} onClose={() => undefined} />);
    expect(await screen.findByText("MK1 ships in March.")).toBeTruthy();
    expect(screen.getAllByText(/\$0\.015/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2026-11-21/).length).toBeGreaterThan(0);
    const sendBtn = screen.getByRole("button", { name: /Send this post to X/ });
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/tick that you have read it first/)).toBeTruthy();

    const record = await screen.findByRole("button", { name: /Record that I read it/ });
    expect((record as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /I have read what X charges/ }));
    fireEvent.click(record);
    await waitFor(() => expect(srv.calls.some((c) => c.path === "/api/channels/x/ack")).toBe(true));
    expect(srv.calls.find((c) => c.path === "/api/channels/x/ack")!.body).toEqual({ version: X_COST_STATEMENT.version, read: true });

    await waitFor(() => expect((screen.getByRole("button", { name: /Send this post to X/ }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: /Send this post to X/ }));
    expect(await screen.findByText(/gave it the id/)).toBeTruthy();
    const sent = srv.calls.find((c) => c.path === "/api/channels/send")!;
    expect(sent.body).toEqual({ projectId: P, kind: "post", itemId: 7, confirm: { channel: "x", itemId: 7, textSha256: "f".repeat(64) } });
  });

  it("shows the server's refusal and sends nothing more", async () => {
    const srv = adminServer([
      on("GET", "/api/channels/send/preview", () => ({ body: preview() }), true),
      on("GET", "/api/channels/status", () => ({ body: status(true) }), true),
      on("POST", "/api/channels/send", () => ({ status: 409, body: { error: "The text changed after you confirmed." } })),
    ]);
    renderWithClient(<SendDialog projectId={P} kind="post" itemId={7} onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole("button", { name: /Send this post to X/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/text changed/);
    expect(srv.calls.filter((c) => c.path === "/api/channels/send")).toHaveLength(1);
  });
});
