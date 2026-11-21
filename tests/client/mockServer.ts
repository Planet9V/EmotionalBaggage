import { vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Item } from "@/lib/types";

export type Call = { method: string; path: string; body: unknown };
type Rule = { method: string; match: (path: string, body: unknown) => boolean; status?: number; delay?: number; hold?: Promise<void> };

/**
 * A stand-in for the API routes the client hooks use, installed as global fetch.
 * PATCH applies the change the way src/app/api/items/[id]/route.ts does (COALESCE on the columns,
 * `data || change` on data) at the moment the request arrives, and answers after its delay.
 */
export function mockServer(rows: Item[], opts: { settings?: { currency?: string; regions?: string[]; productType?: string } } = {}) {
  const settings = { currency: "USD", regions: [] as string[], productType: "electronics", ...opts.settings };
  const db = new Map(rows.map((r) => [r.id, structuredClone(r)]));
  const calls: Call[] = [];
  const rules: Rule[] = [];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;

  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const wait = (ms: number, signal?: AbortSignal | null) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      });
    });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://test.local");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const path = url.pathname + url.search;
    calls.push({ method, path, body });
    const rule = rules.find((r) => r.method === method && r.match(path, body));

    // Work out the answer now (as a server would on arrival), send it after the delay.
    let status = 200;
    let out: unknown;
    const items = /^\/api\/projects\/([^/]+)\/items$/.exec(url.pathname);
    const one = /^\/api\/items\/(\d+)$/.exec(url.pathname);
    if (rule?.status && rule.status >= 400) {
      status = rule.status;
      out = { error: `Forced failure (${rule.status})` };
    } else if (items && method === "GET") {
      const section = url.searchParams.get("section");
      out = { items: [...db.values()].filter((r) => r.projectId === items[1] && (!section || r.section === section)).map((r) => structuredClone(r)) };
    } else if (items && method === "POST") {
      const b = body as { section: string; title: string; body?: string; data?: Record<string, unknown>; status?: string };
      const row: Item = { id: nextId++, projectId: items[1], section: b.section, title: b.title, body: b.body ?? "", data: b.data ?? {}, status: b.status ?? "open", sort: nextId };
      db.set(row.id, row);
      status = 201;
      out = { item: structuredClone(row) };
    } else if (one && method === "PATCH") {
      const row = db.get(Number(one[1]));
      if (!row) {
        status = 404;
        out = { error: "That row was not found." };
      } else {
        const c = body as Partial<Item>;
        for (const k of ["title", "body", "status", "sort"] as const) if (c[k] != null) (row as Record<string, unknown>)[k] = c[k];
        if (c.data) row.data = { ...row.data, ...c.data };
        out = { item: structuredClone(row) };
      }
    } else if (one && method === "DELETE") {
      db.delete(Number(one[1]));
      out = { ok: true };
    } else if (url.pathname === "/api/integrations") {
      out = { integrations: [{ key: "x", name: "X", purpose: "", env: [], configured: false, built: "no", note: "" }], database: { connected: true, vector: false }, planner: { connected: false } };
    } else if (/^\/api\/projects\/[^/]+\/plan$/.test(url.pathname)) {
      out = { engine: "fallback", nodes: [], order: [], criticalPath: [], totalMinutes: 0, cycles: [] };
    } else if (/^\/api\/projects\/[^/]+\/production-settings$/.test(url.pathname) && method === "GET") {
      out = { ...settings };
    } else if (/^\/api\/projects\/[^/]+\/events$/.test(url.pathname)) {
      out = { events: [] };
    } else {
      status = 404;
      out = { error: `No mock for ${method} ${path}` };
    }
    if (rule?.hold) await rule.hold;
    await wait(rule?.delay ?? 5, init?.signal);
    return reply(status, out);
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    db,
    calls,
    /** Calls with this method whose path starts with the prefix. */
    count: (method: string, prefix: string) => calls.filter((c) => c.method === method && c.path.startsWith(prefix)).length,
    rule: (r: Rule) => rules.push(r),
    /** Hold matching requests until the returned function is called. */
    hold: (method: string, match: Rule["match"], status?: number) => {
      let release = () => {};
      const p = new Promise<void>((r) => (release = r));
      rules.push({ method, match, hold: p, status });
      return release;
    },
  };
}

export function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: Infinity }, mutations: { retry: false } } });
}

export function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

export const row = (id: number, section: string, extra: Partial<Item> = {}): Item => ({
  id,
  projectId: "p1",
  section,
  title: `row ${id}`,
  body: "",
  data: {},
  status: "open",
  sort: id,
  ...extra,
});
