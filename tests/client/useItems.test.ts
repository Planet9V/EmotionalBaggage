// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useItems } from "@/lib/client";
import { keys, queries } from "@/lib/queries";
import type { Item } from "@/lib/types";
import { freshClient, mockServer, row, wrapperFor } from "./mockServer";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const BOM = "design/bom";

/** Render useItems on a fresh client and wait for the first load. */
async function loaded(rows: Item[], store: string | null = BOM) {
  const server = mockServer(rows);
  const client = freshClient();
  const hook = renderHook(({ s }) => useItems("p1", s), { wrapper: wrapperFor(client), initialProps: { s: store } });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { server, client, hook };
}
const rowOf = (items: Item[], id: number) => items.find((x) => x.id === id)!;

describe("useItems patch", () => {
  it("rolls a failed patch back and rejects, so the caller's catch runs (defect 1)", async () => {
    const { server, hook } = await loaded([row(1, BOM, { title: "Battery", status: "to buy" })]);
    const release = server.hold("PATCH", () => true, 500);

    let caught = "";
    let p!: Promise<void>;
    act(() => {
      p = hook.result.current.patch(1, { title: "Changed", status: "ordered" });
      p.catch((e: Error) => (caught = e.message));
    });
    await waitFor(() => expect(rowOf(hook.result.current.items, 1).title).toBe("Changed"));
    const optimistic = rowOf(hook.result.current.items, 1).title;
    release();
    await act(async () => {
      await p.catch(() => {});
    });

    expect(optimistic).toBe("Changed");
    expect(caught).toBe("Forced failure (500)");
    expect(rowOf(hook.result.current.items, 1)).toMatchObject({ title: "Battery", status: "to buy" });
    expect(hook.result.current.writeError).toBe("Forced failure (500)");
  });

  it("merges data key by key while the request is in flight, as the server does", async () => {
    const { server, hook } = await loaded([row(1, BOM, { data: { ref: "U1", qty: 2, geometry: { pos: [0, 0, 0] } } })]);
    const release = server.hold("PATCH", () => true);

    let p!: Promise<void>;
    act(() => {
      p = hook.result.current.patch(1, { data: { qty: 3, geometry: { pos: [1, 2, 3] } } });
    });
    await waitFor(() => expect(rowOf(hook.result.current.items, 1).data.qty).toBe(3));
    const optimistic = rowOf(hook.result.current.items, 1).data;
    expect(optimistic).toEqual({ ref: "U1", qty: 3, geometry: { pos: [1, 2, 3] } });

    release();
    await act(async () => p);
    // The server's merge gives the same row the client drew optimistically.
    expect(server.db.get(1)!.data).toEqual(optimistic);
    await waitFor(() => expect(rowOf(hook.result.current.items, 1).data).toEqual(optimistic));
  });

  it("keeps both of two overlapping patches to different keys of one row (defect 4)", async () => {
    const { server, client, hook } = await loaded([row(1, BOM, { data: { a: 0, b: 0 } })]);
    // The first write reaches the server first but answers last, with the row as it was before the second.
    server.rule({ method: "PATCH", match: (_p, b) => (b as { data?: { a?: number } }).data?.a === 1, delay: 60 });
    server.rule({ method: "PATCH", match: (_p, b) => (b as { data?: { b?: number } }).data?.b === 2, delay: 5 });

    const gets = () => server.count("GET", "/api/projects/p1/items?section=design%2Fbom");
    const getsBefore = gets();
    let cachedAfterBoth: Item[] | undefined;
    await act(async () => {
      const first = hook.result.current.patch(1, { data: { a: 1 } });
      await new Promise((r) => setTimeout(r, 1));
      const second = hook.result.current.patch(1, { data: { b: 2 } });
      await Promise.all([first, second]);
      // Straight after both settle, before the refresh has answered (it is at most just sent):
      cachedAfterBoth = client.getQueryData<Item[]>(keys.items("p1", BOM));
      expect(server.calls.filter((c) => c.method === "GET").length - getsBefore).toBeLessThanOrEqual(1);
    });
    expect(rowOf(cachedAfterBoth!, 1).data).toEqual({ a: 1, b: 2 });
    await waitFor(() => expect(server.count("GET", "/api/projects/p1/items?section=design%2Fbom")).toBeGreaterThan(1));
    await waitFor(() => expect(rowOf(hook.result.current.items, 1).data).toEqual({ a: 1, b: 2 }));
  });

  it("refreshes the store, the all-items list and the plan once the last write settles", async () => {
    const { server, client, hook } = await loaded([row(1, BOM)]);
    const all = renderHook(() => useItems("p1", null), { wrapper: wrapperFor(client) });
    const plan = renderHook(() => useQuery(queries.plan("p1")), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(all.result.current.loading).toBe(false));
    await waitFor(() => expect(plan.result.current.isSuccess).toBe(true));
    const before = { store: server.count("GET", "/api/projects/p1/items?section="), all: server.calls.filter((c) => c.path === "/api/projects/p1/items").length, plan: server.count("GET", "/api/projects/p1/plan") };

    await act(async () => hook.result.current.patch(1, { title: "x" }));
    await waitFor(() => expect(server.count("GET", "/api/projects/p1/plan")).toBe(before.plan + 1));
    expect(server.count("GET", "/api/projects/p1/items?section=")).toBe(before.store + 1);
    expect(server.calls.filter((c) => c.path === "/api/projects/p1/items").length).toBe(before.all + 1);
    // The optimistic change also reached the all-items list.
    expect(rowOf(all.result.current.items, 1).title).toBe("x");
  });
});

describe("useItems remove and add", () => {
  it("puts a row back where it was when the delete fails, and rejects (defect 2)", async () => {
    const { server, hook } = await loaded([row(1, BOM), row(2, BOM), row(3, BOM)]);
    const release = server.hold("DELETE", () => true, 500);
    let caught = "";
    let p!: Promise<void>;
    act(() => {
      p = hook.result.current.remove(2);
      p.catch((e: Error) => (caught = e.message));
    });
    await waitFor(() => expect(hook.result.current.items.map((x) => x.id)).toEqual([1, 3]));
    const during = hook.result.current.items.map((x) => x.id);
    release();
    await act(async () => {
      await p.catch(() => {});
    });
    expect(during).toEqual([1, 3]);
    expect(caught).toBe("Forced failure (500)");
    expect(hook.result.current.items.map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it("removes the row for good when the delete succeeds", async () => {
    const { server, hook } = await loaded([row(1, BOM), row(2, BOM)]);
    await act(async () => hook.result.current.remove(1));
    expect(hook.result.current.items.map((x) => x.id)).toEqual([2]);
    expect(server.db.has(1)).toBe(false);
  });

  it("appends the row the server returns", async () => {
    const { hook } = await loaded([row(1, BOM)]);
    let made!: Item;
    await act(async () => {
      made = await hook.result.current.add({ section: BOM, title: "New part", data: { ref: "R9" } });
    });
    expect(made.id).toBe(2);
    await waitFor(() => expect(hook.result.current.items.map((x) => x.title)).toEqual(["row 1", "New part"]));
  });

  it("a write nobody awaits leaves no unhandled rejection and shows in writeError", async () => {
    const { server, hook } = await loaded([row(1, BOM, { status: "to buy" })]);
    server.rule({ method: "PATCH", match: () => true, status: 409 });
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    act(() => {
      void hook.result.current.patch(1, { status: "ordered" });
    });
    await waitFor(() => expect(hook.result.current.writeError).toBe("Forced failure (409)"));
    await new Promise((r) => setTimeout(r, 20));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(rowOf(hook.result.current.items, 1).status).toBe("to buy");
  });
});

describe("sharing and de-duplication (defect 5)", () => {
  it("two components on the same (concept, store) send one request", async () => {
    const server = mockServer([row(1, BOM), row(2, "design/wiring")]);
    const client = freshClient();
    const both = renderHook(() => ({ a: useItems("p1", BOM), b: useItems("p1", BOM) }), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(both.result.current.a.loading).toBe(false));
    expect(both.result.current.b.items).toHaveLength(1);
    expect(server.count("GET", "/api/projects/p1/items?section=design%2Fbom")).toBe(1);
  });

  it("three consumers of the integrations report send one request", async () => {
    const server = mockServer([]);
    const client = freshClient();
    const w = wrapperFor(client);
    const one = renderHook(() => useQuery(queries.integrations()), { wrapper: w });
    const two = renderHook(() => useQuery({ ...queries.integrations(), select: (r) => r.integrations.filter((i) => i.key === "x") }), { wrapper: w });
    const three = renderHook(() => useQuery({ ...queries.integrations(), select: (r) => r.integrations.find((i) => i.key === "amazon-sell") ?? null }), { wrapper: w });
    await waitFor(() => expect(one.result.current.isSuccess && two.result.current.isSuccess && three.result.current.isSuccess).toBe(true));
    expect(two.result.current.data).toHaveLength(1);
    expect(three.result.current.data).toBeNull();
    expect(server.count("GET", "/api/integrations")).toBe(1);
  });

  it("a change made through one hook is seen by another hook on the same store, with no reload", async () => {
    const server = mockServer([row(1, BOM, { data: { geometry: { pos: [0, 0, 0] } } })]);
    const client = freshClient();
    const layout = renderHook(() => useItems("p1", BOM), { wrapper: wrapperFor(client) });
    const model = renderHook(() => useItems("p1", BOM), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(model.result.current.loading).toBe(false));
    const release = server.hold("PATCH", () => true);
    let p!: Promise<void>;
    act(() => {
      p = layout.result.current.patch(1, { data: { geometry: { pos: [5, 0, 7] } } });
    });
    // Visible in the other view at once (optimistic), before the server has answered.
    await waitFor(() => expect(rowOf(model.result.current.items, 1).data.geometry).toEqual({ pos: [5, 0, 7] }));
    release();
    await act(async () => p);
    expect(rowOf(model.result.current.items, 1).data.geometry).toEqual({ pos: [5, 0, 7] });
  });

  it("cancels the request of a store nobody needs any more", async () => {
    const server = mockServer([row(1, BOM)]);
    const client = freshClient();
    const release = server.hold("GET", (p) => p.includes("section="));
    const hook = renderHook(() => useItems("p1", BOM), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(server.count("GET", "/api/projects/p1/items")).toBe(1));
    const signal = server.calls.length ? (vi.mocked(fetch).mock.calls[0][1] as RequestInit).signal : undefined;
    expect(signal).toBeInstanceOf(AbortSignal);
    hook.unmount();
    await client.cancelQueries({ queryKey: keys.items("p1", BOM) });
    expect(signal!.aborted).toBe(true);
    release();
  });
});

describe("loading (defect 3)", () => {
  it("is false when there is no concept, and sends nothing", async () => {
    const server = mockServer([row(1, BOM)]);
    const hook = renderHook(() => useItems(undefined, BOM), { wrapper: wrapperFor(freshClient()) });
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.items).toEqual([]);
    await new Promise((r) => setTimeout(r, 20));
    expect(server.calls).toHaveLength(0);
    await act(async () => hook.result.current.reload());
    expect(server.calls).toHaveLength(0);
  });

  it("is true again while a different store loads", async () => {
    const { server, hook } = await loaded([row(1, BOM), row(2, "design/wiring")]);
    expect(hook.result.current.loading).toBe(false);
    const release = server.hold("GET", (p) => p.includes("design%2Fwiring"));
    hook.rerender({ s: "design/wiring" });
    expect(hook.result.current.loading).toBe(true);
    release();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.items.map((x) => x.id)).toEqual([2]);
  });
});
