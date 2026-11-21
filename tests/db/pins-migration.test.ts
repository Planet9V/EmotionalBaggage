import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// migrations/0014_pins.sql on a database written by the old code: wires through a part in series
// (`via`) and parts that listed pin names in data.pins. Runs in its own scratch database.
const base = new URL(process.env.DATABASE_URL ?? "postgresql://c2r:c2r@localhost:5432/c2r");
const scratch = `c2r_pins_upgrade_${process.pid}`;
const scratchUrl = (() => {
  const u = new URL(base.toString());
  u.pathname = `/${scratch}`;
  return u.toString();
})();

let db: typeof import("@/lib/db");

beforeAll(async () => {
  const a = new Client({ connectionString: base.toString() });
  await a.connect();
  await a.query(`DROP DATABASE IF EXISTS ${scratch}`);
  await a.query(`CREATE DATABASE ${scratch}`);
  await a.end();
  const old = new Client({ connectionString: scratchUrl });
  await old.connect();
  await old.query(readFileSync("migrations/0001_baseline.sql", "utf8"));
  await old.query("INSERT INTO projects (id, name) VALUES ('old', 'An older concept')");
  const add = (section: string, title: string, data: unknown, sort: number) =>
    old.query("INSERT INTO items (project_id, section, title, data, sort) VALUES ('old', $1, $2, $3, $4)", [section, title, JSON.stringify(data), sort]);
  await add("design/bom", "Board", { ref: "U1", pins: ["SPARE", "GPIO5"] }, 1);
  await add("design/bom", "Module", { ref: "U3" }, 2);
  await add("design/bom", "Resistor", { ref: "R1" }, 3);
  await add("design/wiring", "UART to module", { order: 11, net: "UART1", netClass: "signal", from: "U1", fromPin: "GPIO17", to: "U3", toPin: "RX", via: "R1", schematic: { x: 1, y: 2 } }, 4);
  await add("design/wiring", "Plain wire", { order: 12, net: "UART1", netClass: "signal", from: "U3", fromPin: "TX", to: "U1", toPin: "GPIO16", via: "" }, 5);
  await add("design/wiring", "Through a missing part", { order: 13, from: "U1", fromPin: "GPIO4", to: "U3", toPin: "BUSY", via: "R9" }, 6);
  await old.end();
  process.env.DATABASE_URL = scratchUrl;
  db = await import("@/lib/db");
  await db.ready();
});

afterAll(async () => {
  await db.pool().end();
  const a = new Client({ connectionString: base.toString() });
  await a.connect();
  await a.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`);
  await a.end();
});

describe("migration 0014: pins become rows, a part in series becomes an ordinary part", () => {
  it("splits each wire with a via into two wires, one to each pin of the series part, and logs it", async () => {
    const wires = await db.q<{ title: string; data: Record<string, unknown> }>("SELECT title, data FROM items WHERE section='design/wiring' ORDER BY id");
    expect(wires).toHaveLength(5);
    const ends = wires.map((w) => `${w.data.from}.${w.data.fromPin}>${w.data.to}.${w.data.toPin}`);
    expect(ends).toEqual(expect.arrayContaining(["U1.GPIO17>R1.1", "R1.2>U3.RX", "U3.TX>U1.GPIO16", "U1.GPIO4>R9.1", "R9.2>U3.BUSY"]));
    for (const w of wires) {
      expect(w.data.via).toBeUndefined();
      expect(w.data.schematic).toBeUndefined();
    }
    const split = wires.filter((w) => w.data.order === 11);
    expect(split.map((w) => w.data.net)).toEqual(["UART1", "UART1"]);
    const log = await db.q<{ summary: string }>("SELECT summary FROM events WHERE kind='upgrade.via_split' ORDER BY id");
    expect(log).toHaveLength(2);
    expect(log[0].summary).toContain("R1");
  });

  it("gives the series part pins 1 and 2, moves listed pin names into rows with the names wires use, and clears data.pins", async () => {
    const pins = await db.q<{ ref: string; name: string; kind: string | null }>(
      "SELECT i.data->>'ref' AS ref, p.name, p.kind FROM pins p JOIN items i ON i.id = p.item_id ORDER BY i.data->>'ref', p.sort"
    );
    const of = (ref: string) => pins.filter((p) => p.ref === ref).map((p) => p.name);
    expect(of("R1")).toEqual(["1", "2"]);
    expect(pins.filter((p) => p.ref === "R1").every((p) => p.kind === "passive")).toBe(true);
    expect(of("U1")).toEqual(["SPARE", "GPIO5", "GPIO17", "GPIO16", "GPIO4"]);
    expect(pins.filter((p) => p.ref === "U1").every((p) => p.kind === null)).toBe(true);
    expect(of("U3")).toEqual([]);
    const data = await db.q<{ data: Record<string, unknown> }>("SELECT data FROM items WHERE data->>'ref'='U1'");
    expect(data[0].data.pins).toBeUndefined();
    const log = await db.q<{ summary: string }>("SELECT summary FROM events WHERE kind='upgrade.pins_rows' ORDER BY id");
    expect(log.map((l) => l.summary).join(" ")).toMatch(/U1[\s\S]*R1|R1[\s\S]*U1/);
  });

  it("enforces one name per part and removes pins with their part", async () => {
    const u1 = await db.q<{ id: string }>("SELECT id FROM items WHERE data->>'ref'='U1'");
    await expect(db.q("INSERT INTO pins (project_id, item_id, name) VALUES ('old', $1, 'SPARE')", [u1[0].id])).rejects.toMatchObject({ code: "23505" });
    await expect(db.q("INSERT INTO pins (project_id, item_id, name, kind) VALUES ('old', $1, 'Z', 'flux')", [u1[0].id])).rejects.toMatchObject({ code: "23514" });
    await db.q("DELETE FROM items WHERE id=$1", [u1[0].id]);
    expect(await db.q("SELECT 1 FROM pins WHERE item_id=$1", [u1[0].id])).toHaveLength(0);
  });
});
