// Leftover decision: a post or reply moved to posted (sent) by hand is kept, and recorded as marked by hand
// (data.sent.byHand), shown so on the row and in the report, never as a send the app made.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { buildReport } from "@/components/plan/report";
import { sentText } from "@/lib/channels/sentText";
import { ctx, json, read } from "../api/helpers";
import type { Item } from "@/lib/types";

const P = "zz-hand-marked";
beforeAll(async () => {
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await q("INSERT INTO projects (id, name, one_liner) VALUES ($1,'ZZ Hand','A test')", [P]);
});
afterAll(async () => {
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await pool().end();
});

const add = async (section: string, status: string, data: Record<string, unknown> = {}) =>
  Number((await q<{ id: string }>("INSERT INTO items (project_id, section, title, body, data, status) VALUES ($1,$2,'Launch post','We are live',$3,$4) RETURNING id", [P, section, JSON.stringify(data), status]))[0].id);

describe("marked posted by hand", () => {
  it("a social post moved to posted by hand carries sent.byHand, and still cannot be set by the client", async () => {
    const id = await add("marketing/social", "approved", { channel: "linkedin" });
    const r = await read<{ item: Item }>(await patchItem(json("PATCH", { status: "posted" }), ctx(String(id))));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.item.data.sent).toMatchObject({ byHand: true, by: "demo" });
    expect(sentText(r.body.item.data)).toMatch(/^marked posted by hand on \d{4}-\d{2}-\d{2}, not sent by the app$/);
    const forged = await read<{ error: string }>(await patchItem(json("PATCH", { data: { sent: { id: "x" } } }), ctx(String(id))));
    expect(forged.status).toBe(400);
  });

  it("a reply moved to sent by hand is recorded the same way", async () => {
    const id = await add("marketing/replies", "approved", { channel: "Other" });
    const r = await read<{ item: Item }>(await patchItem(json("PATCH", { status: "sent" }), ctx(String(id))));
    expect(r.body.item.data.sent).toMatchObject({ byHand: true });
  });

  it("the report says so, and shows other fields in words, not JSON", () => {
    const item: Item = { id: 1, projectId: P, section: "marketing/social", title: "Launch post", body: "We are live", status: "posted", sort: 1, data: { channel: "Other", sent: { byHand: true, at: "2026-11-21T10:00:00Z", by: "demo" }, sourcing: { offers: [] }, leadTimeDays: 3, tags: ["a", "b"], meta: { width: 2 } } };
    const blocks = buildReport({ id: P, name: "ZZ", oneLiner: "" } as never, { items: [item], files: [], plan: null, research: null, challenge: null, events: [] } as never, {});
    const table = blocks.find((b) => b.t === "table" && b.head.includes("Other fields")) as { head: string[]; rows: string[][] };
    const cell = table.rows[0][table.head.indexOf("Other fields")];
    expect(cell).toContain("sent: marked posted by hand on 2026-11-21, not sent by the app");
    expect(cell).toContain("lead time days: 3");
    expect(cell).toContain("tags: a, b");
    expect(cell).toContain("meta: width 2");
    expect(cell).not.toMatch(/[{}]/);
  });
});
