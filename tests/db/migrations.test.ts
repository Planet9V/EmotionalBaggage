import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// This file builds a database the way an install looked BEFORE migrations existed,
// puts the kinds of rows in it that the old code allowed, and then starts the app's
// database layer against it. It runs in its own worker, so pointing DATABASE_URL at
// the scratch database here does not affect other test files.
const base = new URL(process.env.DATABASE_URL ?? "postgresql://c2r:c2r@localhost:5432/c2r");
const scratch = `c2r_upgrade_${process.pid}`;
const admin = () => new Client({ connectionString: base.toString() });
const scratchUrl = (() => {
  const u = new URL(base.toString());
  u.pathname = `/${scratch}`;
  return u.toString();
})();

let db: typeof import("@/lib/db");

beforeAll(async () => {
  const a = admin();
  await a.connect();
  await a.query(`DROP DATABASE IF EXISTS ${scratch}`);
  await a.query(`CREATE DATABASE ${scratch}`);
  await a.end();

  const old = new Client({ connectionString: scratchUrl });
  await old.connect();
  // The pre-migration schema is exactly the baseline file.
  await old.query(readFileSync("migrations/0001_baseline.sql", "utf8"));
  await old.query("INSERT INTO projects (id, name) VALUES ('old', 'An older concept')");
  const add = (section: string, title: string, data: unknown, sort: number) =>
    old.query("INSERT INTO items (project_id, section, title, data, sort) VALUES ('old', $1, $2, $3, $4)", [section, title, JSON.stringify(data), sort]);
  await add("design/bom", "Board", { ref: "U1" }, 1);
  await add("design/bom", "Second board", { ref: "U1" }, 2);
  await add("design/bom", "Third board", { ref: "U1" }, 3);
  await add("design/bom", "No reference", {}, 4);
  await add("design/bom", "Also no reference", { ref: "" }, 5);
  await add("prototype/assembly", "Step one", { key: "s1", minutes: 5 }, 6);
  await add("prototype/assembly", "Step two", { key: "s2", after: "s1, s0 ,", minutes: 5 }, 7);
  await add("prototype/tests", "Clashing key", { key: "s1" }, 8);
  await add("concept/decisions", "Go?", { key: "go", dependsOn: "", unlocks: "prototype/assembly, sales/listing" }, 9);
  await old.query("INSERT INTO research (project_id, query, answer, citations) VALUES ('old', 'Older question', 'a', $1)", [JSON.stringify(["https://a.example/1", "https://b.example/2"])]);
  await old.end();

  process.env.DATABASE_URL = scratchUrl;
  db = await import("@/lib/db");
  await db.ready();
});

afterAll(async () => {
  await db.pool().end();
  const a = admin();
  await a.connect();
  await a.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`);
  await a.end();
});

describe("upgrading a database from before migrations", () => {
  it("records each migration once, and a second start changes nothing", async () => {
    const first = await db.q<{ name: string }>("SELECT name FROM schema_migrations ORDER BY id");
    expect(first.map((r) => r.name)).toEqual(["0001_baseline", "0002_integrity", "0003_concepts_and_admin", "0004_sign_in", "0005_audit_log", "0006_research_sources", "0007_chat", "0008_search", "0009_process", "0011_economics", "0012_drafts", "0014_pins", "0018_print_jobs"]);
    const g = globalThis as { __c2rReady?: unknown };
    g.__c2rReady = undefined;
    await db.ready();
    const second = await db.q<{ name: string }>("SELECT name FROM schema_migrations ORDER BY id");
    expect(second).toEqual(first);
  });

  it("gives older research rows sources built from their citation URLs, with empty titles", async () => {
    const rows = await db.q<{ sources: unknown }>("SELECT sources FROM research WHERE project_id='old'");
    expect(rows[0].sources).toEqual([{ url: "https://a.example/1", title: "" }, { url: "https://b.example/2", title: "" }]);
  });

  it("keeps every existing row", async () => {
    const rows = await db.q<{ n: number }>("SELECT count(*)::int AS n FROM items WHERE project_id='old'");
    expect(rows[0].n).toBe(9);
  });

  it("makes repeated part references unique and says so in the history", async () => {
    const refs = await db.q<{ ref: string }>("SELECT data->>'ref' AS ref FROM items WHERE section='design/bom' AND data->>'ref' <> '' ORDER BY sort");
    expect(refs.map((r) => r.ref)).toEqual(["U1", "U1-2", "U1-3"]);
    const log = await db.q<{ summary: string }>("SELECT summary FROM events WHERE kind='upgrade.ref_renamed' ORDER BY id");
    expect(log.length).toBe(2);
    expect(log[0].summary).toContain("U1-2");
  });

  it("makes repeated keys unique across sections", async () => {
    const keys = await db.q<{ key: string }>("SELECT data->>'key' AS key FROM items WHERE data ? 'key' ORDER BY sort");
    expect(keys.map((r) => r.key)).toEqual(["s1", "s2", "s1-2", "go"]);
  });

  it("turns comma-string key lists into arrays", async () => {
    const rows = await db.q<{ title: string; data: Record<string, unknown> }>("SELECT title, data FROM items WHERE data ?| array['after','dependsOn','unlocks'] ORDER BY sort");
    expect(rows.find((r) => r.title === "Step two")?.data.after).toEqual(["s1", "s0"]);
    const go = rows.find((r) => r.title === "Go?")?.data;
    expect([go?.dependsOn, go?.unlocks]).toEqual([[], ["prototype/assembly", "sales/listing"]]);
  });

  it("does not load the example concept into a database that already has concepts", async () => {
    const ids = await db.q<{ id: string }>("SELECT id FROM projects");
    expect(ids.map((r) => r.id)).toEqual(["old"]);
    const mark = await db.q<{ value: { loaded: boolean } }>("SELECT value FROM settings WHERE key='seed.example'");
    expect(mark[0].value.loaded).toBe(false);
  });
});

describe("rules the database enforces from now on", () => {
  const insert = (section: string, data: unknown, title = "x") =>
    db.q("INSERT INTO items (project_id, section, title, data) VALUES ('old', $1, $2, $3)", [section, title, JSON.stringify(data)]);

  it("refuses a second part with the same reference, and a second row with the same key", async () => {
    await expect(insert("design/bom", { ref: "U1" })).rejects.toMatchObject({ code: "23505", constraint: "items_part_ref_unique" });
    await expect(insert("concept/brief", { key: "go" })).rejects.toMatchObject({ code: "23505", constraint: "items_key_unique" });
  });

  it("allows any number of parts with no reference, and the same reference in another concept", async () => {
    await insert("design/bom", {});
    await insert("design/bom", { ref: "" });
    await db.q("INSERT INTO projects (id, name) VALUES ('other', 'Other')");
    await db.q("INSERT INTO items (project_id, section, title, data) VALUES ('other', 'design/bom', 'x', $1)", [JSON.stringify({ ref: "U1" })]);
  });

  it("refuses data that is not an object, a blank title, a blank concept name and an unknown message role", async () => {
    await expect(db.q("INSERT INTO items (project_id, section, title, data) VALUES ('old','concept/brief','x','[1]')")).rejects.toMatchObject({ code: "23514" });
    await expect(insert("concept/brief", {}, "   ")).rejects.toMatchObject({ code: "23514" });
    await expect(db.q("INSERT INTO projects (id, name) VALUES ('blank', '  ')")).rejects.toMatchObject({ code: "23514" });
    await expect(db.q("INSERT INTO messages (project_id, role, content) VALUES ('old','system','x')")).rejects.toMatchObject({ code: "23514" });
  });

  it("removes a concept's rows, files, history and gates with it", async () => {
    await db.q("INSERT INTO gates (project_id, stage) VALUES ('other', 'concept')");
    await db.q("INSERT INTO events (project_id, kind, summary) VALUES ('other', 't', 't')");
    await db.q("DELETE FROM projects WHERE id='other'");
    for (const t of ["items", "gates", "events", "files", "messages", "research"]) {
      const left = await db.q<{ n: number }>(`SELECT count(*)::int AS n FROM ${t} WHERE project_id='other'`);
      expect([t, left[0].n]).toEqual([t, 0]);
    }
  });

  it("requires a reason to override a gate and allows only the four gate statuses", async () => {
    await expect(db.q("INSERT INTO gates (project_id, stage, overridden) VALUES ('old','design', true)")).rejects.toMatchObject({ code: "23514" });
    await expect(db.q("INSERT INTO gates (project_id, stage, status) VALUES ('old','design','maybe')")).rejects.toMatchObject({ code: "23514" });
    await db.q("INSERT INTO gates (project_id, stage, status, overridden, note) VALUES ('old','design','go', true, 'Owner accepted the risk')");
  });

  it("keeps one value per credential field and refuses a blank one", async () => {
    await db.q("INSERT INTO credentials (provider, field, value) VALUES ('openrouter','apiKey','k1')");
    await expect(db.q("INSERT INTO credentials (provider, field, value) VALUES ('openrouter','apiKey','k2')")).rejects.toMatchObject({ code: "23505" });
    await expect(db.q("INSERT INTO credentials (provider, field, value) VALUES ('openrouter','other',' ')")).rejects.toMatchObject({ code: "23514" });
  });
});
