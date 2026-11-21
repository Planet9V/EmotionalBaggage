// D1: the embeddings table used to be created inside a bare catch {}, so a failure vanished. It is now logged
// and shown in Admin, Setup.
import { afterAll, describe, expect, it } from "vitest";
import { pool, ready } from "@/lib/db";
import { firstRunStatus } from "@/lib/admin/status";

afterAll(async () => {
  await pool().end();
});

describe("a failed embeddings table", () => {
  it("is not on the Setup list when all is well", async () => {
    const r = await ready();
    expect(r.vectorProblem).toBeNull();
    expect((await firstRunStatus()).items.find((i) => i.key === "vectorStore")).toBeUndefined();
  });

  it("is shown on the Setup list, not set up, with the reason", async () => {
    const g = globalThis as { __c2rReady?: unknown };
    const real = g.__c2rReady;
    g.__c2rReady = Promise.resolve({ vector: false, vectorProblem: "The embeddings table could not be set up: permission denied for schema public" });
    try {
      const s = await firstRunStatus();
      const row = s.items.find((i) => i.key === "vectorStore");
      expect(row).toMatchObject({ configured: false, label: "Search by meaning" });
      expect(row!.state).toMatch(/permission denied/);
      expect(s.complete).toBe(false);
    } finally {
      g.__c2rReady = real;
    }
  });
});
