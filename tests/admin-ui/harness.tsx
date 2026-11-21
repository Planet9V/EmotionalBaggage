// Shared harness for the Admin screen tests: a fetch stand-in answering the Admin routes from fixed
// data, a fresh query client, and the browser APIs jsdom lacks that Radix menus and selects call.
import { vi } from "vitest";
import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export type Call = { method: string; path: string; body: unknown };
export type Handler = (call: Call) => { status?: number; body: unknown } | undefined;

/** Installs fetch answering through the handlers, in order; the first that answers wins. Unknown paths are 404. */
export function adminServer(handlers: Handler[]) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://test.local");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const call = { method, path: url.pathname + url.search, body };
    calls.push(call);
    for (const h of handlers) {
      const r = h(call);
      if (r) return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: `No stand-in for ${method} ${call.path}` }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

/** Answers one method and exact path (query string included unless `prefix`). */
export const on =
  (method: string, path: string, answer: (c: Call) => { status?: number; body: unknown }, prefix = false): Handler =>
  (c) =>
    c.method === method && (prefix ? c.path.startsWith(path) : c.path === path) ? answer(c) : undefined;

export function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: Infinity }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

/** jsdom lacks these; Radix Select and DropdownMenu call them. */
export function shimBrowser() {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.scrollIntoView ??= () => {};
  proto.hasPointerCapture ??= () => false;
  proto.releasePointerCapture ??= () => {};
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
