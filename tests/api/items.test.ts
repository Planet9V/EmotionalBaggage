import { afterAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET as listItems, POST as addItem } from "@/app/api/projects/[id]/items/route";
import { DELETE as removeItem, PATCH as patchItem } from "@/app/api/items/[id]/route";
import { ctx, json, read, SEEDED } from "./helpers";

type ItemBody = { item: { id: number; section: string; status: string; title: string; data: Record<string, unknown> } };
type ErrBody = { error: string; issues?: { field: string; problem: string }[] };

afterAll(async () => {
  await q("DELETE FROM items WHERE title LIKE 'test:%'");
  await pool().end();
});

async function make(extra: Record<string, unknown> = {}) {
  const res = await addItem(json("POST", { section: "concept/brief", title: "test: row", ...extra }), ctx(SEEDED));
  return read<ItemBody>(res);
}

describe("adding a row", () => {
  it("stores a valid row and gives it the section's first status", async () => {
    const r = await make({ section: "design/bom", data: { ref: "T1" } });
    expect(r.status).toBe(201);
    expect(r.body.item.status).toBe("to buy");
    expect(r.body.item.data).toEqual({ ref: "T1" });
  });

  it("rejects a section the menu does not define", async () => {
    const r = await read<ErrBody>(await addItem(json("POST", { section: "not/a-section", title: "test: x" }), ctx(SEEDED)));
    expect(r.status).toBe(400);
    expect(r.body.issues?.[0].field).toBe("section");
  });

  it("rejects a status the section does not allow", async () => {
    const r = await read<ErrBody>(
      await addItem(json("POST", { section: "concept/brief", title: "test: x", status: "banana" }), ctx(SEEDED))
    );
    expect(r.status).toBe(400);
    expect(r.body.issues?.[0].field).toBe("status");
  });

  it.each([
    ["an array", [1, 2]],
    ["a string", "text"],
    ["null", null],
  ])("rejects data that is %s", async (_name, data) => {
    const r = await read<ErrBody>(await addItem(json("POST", { section: "concept/brief", title: "test: x", data }), ctx(SEEDED)));
    expect(r.status).toBe(400);
  });

  it("rejects a blank title and a body that is not JSON", async () => {
    expect((await addItem(json("POST", { section: "concept/brief", title: "   " }), ctx(SEEDED))).status).toBe(400);
    expect((await addItem(json("POST", "{not json"), ctx(SEEDED))).status).toBe(400);
  });

  it("answers 404 for a concept that does not exist, on read and on write", async () => {
    expect((await addItem(json("POST", { section: "concept/brief", title: "test: x" }), ctx("no-such-concept"))).status).toBe(404);
    expect((await listItems(json("GET"), ctx("no-such-concept"))).status).toBe(404);
  });

  it("answers 400 when listing a section that does not exist", async () => {
    const res = await listItems(json("GET", undefined, "http://test.local/api?section=nope"), ctx(SEEDED));
    expect(res.status).toBe(400);
  });
});

describe("changing a row", () => {
  it("merges data key by key", async () => {
    const made = await make({ data: { a: 1, b: 2 } });
    const r = await read<ItemBody>(await patchItem(json("PATCH", { data: { b: 3, c: 4 } }), ctx(String(made.body.item.id))));
    expect(r.status).toBe(200);
    expect(r.body.item.data).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("cannot turn data into an array (the old corruption bug)", async () => {
    const made = await make({ data: { keep: true } });
    const id = String(made.body.item.id);
    expect((await patchItem(json("PATCH", { data: [1] }), ctx(id))).status).toBe(400);
    expect((await patchItem(json("PATCH", { data: "x" }), ctx(id))).status).toBe(400);
    const rows = await q<{ data: unknown }>("SELECT data FROM items WHERE id=$1", [id]);
    expect(rows[0].data).toEqual({ keep: true });
  });

  it("checks the status against the row's own section", async () => {
    const made = await make({ section: "design/wiring", data: {} });
    const id = String(made.body.item.id);
    expect((await patchItem(json("PATCH", { status: "soldered" }), ctx(id))).status).toBe(200);
    expect((await patchItem(json("PATCH", { status: "done" }), ctx(id))).status).toBe(400);
  });

  it("rejects wrong types and an empty change", async () => {
    const made = await make();
    const id = String(made.body.item.id);
    expect((await patchItem(json("PATCH", { sort: "first" }), ctx(id))).status).toBe(400);
    expect((await patchItem(json("PATCH", { title: 7 }), ctx(id))).status).toBe(400);
    expect((await patchItem(json("PATCH", {}), ctx(id))).status).toBe(400);
  });

  it("answers 404 for an id that is missing or not a number", async () => {
    expect((await patchItem(json("PATCH", { title: "x" }), ctx("999999999"))).status).toBe(404);
    expect((await patchItem(json("PATCH", { title: "x" }), ctx("abc"))).status).toBe(404);
    expect((await removeItem(json("DELETE"), ctx("abc"))).status).toBe(404);
    expect((await removeItem(json("DELETE"), ctx("999999999"))).status).toBe(404);
  });

  it("records the status change and the edit in the activity log", async () => {
    const made = await make();
    const id = made.body.item.id;
    await patchItem(json("PATCH", { status: "done" }), ctx(String(id)));
    const ev = await q<{ kind: string }>("SELECT kind FROM events WHERE data->>'itemId' = $1 ORDER BY id", [String(id)]);
    expect(ev.map((e) => e.kind)).toEqual(["item.added", "item.status"]);
  });

  it("removes a row once, then says it is gone", async () => {
    const made = await make();
    const id = String(made.body.item.id);
    expect((await removeItem(json("DELETE"), ctx(id))).status).toBe(200);
    expect((await removeItem(json("DELETE"), ctx(id))).status).toBe(404);
  });
});

describe("the fields inside a row", () => {
  it("rejects a part whose geometry is malformed, naming the field", async () => {
    const r = await read<ErrBody>(
      await addItem(json("POST", { section: "design/bom", title: "test: bad", data: { ref: "T9", geometry: { shape: "box", size: [10, 0, 5] } } }), ctx(SEEDED))
    );
    expect(r.status).toBe(400);
    expect(r.body.issues?.[0].field).toBe("data.geometry.size.1");
  });

  it("stores numbers as numbers and key lists as arrays, whatever was sent", async () => {
    const r = await make({ section: "prototype/assembly", data: { key: "test-step", after: "p0, p1", minutes: "25" } });
    expect(r.status).toBe(201);
    expect(r.body.item.data).toEqual({ key: "test-step", after: ["p0", "p1"], minutes: 25 });
  });

  it("checks a change against the row's own section", async () => {
    const made = await make({ section: "design/wiring", data: { from: "U1", to: "U2" } });
    const id = String(made.body.item.id);
    expect((await patchItem(json("PATCH", { data: { netClass: "nonsense" } }), ctx(id))).status).toBe(400);
    const ok = await read<ItemBody>(await patchItem(json("PATCH", { data: { netClass: "power", order: "4" } }), ctx(id)));
    expect(ok.body.item.data).toEqual({ from: "U1", to: "U2", netClass: "power", order: 4 });
  });

  it("holds no comma-string key list anywhere in the database after start-up", async () => {
    const rows = await q(
      "SELECT id FROM items WHERE jsonb_typeof(data->'after')='string' OR jsonb_typeof(data->'dependsOn')='string' OR jsonb_typeof(data->'unlocks')='string'"
    );
    expect(rows).toEqual([]);
  });
});

describe("unique references and keys, through the API", () => {
  it("answers 409 with a plain reason for a repeated part reference and a repeated key", async () => {
    const part = { section: "design/bom", title: "test: dup", data: { ref: "TDUP" } };
    expect((await addItem(json("POST", part), ctx(SEEDED))).status).toBe(201);
    const again = await read<ErrBody>(await addItem(json("POST", part), ctx(SEEDED)));
    expect(again.status).toBe(409);
    expect(again.body.error).toContain("already uses that reference");

    const step = { section: "prototype/assembly", title: "test: dupkey", data: { key: "p0" } };
    const clash = await read<ErrBody>(await addItem(json("POST", step), ctx(SEEDED)));
    expect(clash.status).toBe(409);
    expect(clash.body.error).toContain("already uses that key");
  });

  it("answers 409 when a change would repeat another part's reference, and leaves the row as it was", async () => {
    const made = await make({ section: "design/bom", data: { ref: "TDUP2" } });
    const id = String(made.body.item.id);
    const res = await patchItem(json("PATCH", { data: { ref: "U1" } }), ctx(id));
    expect(res.status).toBe(409);
    const rows = await q<{ ref: string }>("SELECT data->>'ref' AS ref FROM items WHERE id=$1", [id]);
    expect(rows[0].ref).toBe("TDUP2");
  });
});
