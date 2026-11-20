// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useItems } from "@/lib/client";
import { useConcept } from "@/components/plan/useConcept";
import { usePlan } from "@/components/plan/usePlan";
import { freshClient, mockServer, row, wrapperFor } from "./mockServer";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useConcept and usePlan", () => {
  it("load each part once, share the all-items list with useItems, and report errors per part", async () => {
    const server = mockServer([row(1, "design/bom"), row(2, "concept/brief")]);
    server.rule({ method: "GET", match: (p) => p.startsWith("/api/research"), status: 503 });
    const client = freshClient();
    const w = wrapperFor(client);
    const concept = renderHook(() => useConcept("p1", ["items", "events", "research"]), { wrapper: w });
    const all = renderHook(() => useItems("p1", null), { wrapper: w });
    await waitFor(() => expect(concept.result.current.loading).toBe(false));
    expect(concept.result.current.data.items.map((x) => x.id)).toEqual([1, 2]);
    expect(concept.result.current.errors).toEqual({ research: "Forced failure (503)" });
    expect(concept.result.current.loadedAt).toBeInstanceOf(Date);
    expect(server.calls.filter((c) => c.path === "/api/projects/p1/items")).toHaveLength(1);

    // A write through useItems shows up in the concept's data without a reload.
    await act(async () => all.result.current.patch(2, { status: "done" }));
    await waitFor(() => expect(concept.result.current.data.items.find((x) => x.id === 2)?.status).toBe("done"));
  });

  it("usePlan is not loading and sends nothing without a concept, and refetches after an item write", async () => {
    const server = mockServer([row(1, "design/bom")]);
    const client = freshClient();
    const none = renderHook(() => usePlan(undefined), { wrapper: wrapperFor(client) });
    expect(none.result.current.loading).toBe(false);
    const plan = renderHook(() => usePlan("p1"), { wrapper: wrapperFor(client) });
    const bom = renderHook(() => useItems("p1", "design/bom"), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(plan.result.current.plan).not.toBeNull());
    await waitFor(() => expect(bom.result.current.loading).toBe(false));
    expect(server.count("GET", "/api/projects/p1/plan")).toBe(1);
    await act(async () => bom.result.current.patch(1, { data: { minutes: 5 } }));
    await waitFor(() => expect(server.count("GET", "/api/projects/p1/plan")).toBe(2));
  });
});
