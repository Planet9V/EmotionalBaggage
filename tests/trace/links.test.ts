// Plan 3.5: requirements link to tests and parts by key; the server refuses bad links and keeps them whole.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as createProject } from "@/app/api/projects/route";
import { json, read } from "../api/helpers";
import { add, drop, events, newConcept, patch, remove } from "./helpers";

let project = "";
let testId = 0;
let test2Id = 0;
let partId = 0;
let reqId = 0;

beforeAll(async () => {
  project = await newConcept("Links probe");
  testId = (await add(project, "prototype/tests", "Drop test", { data: { key: "t-drop" } })).body.item.id;
  test2Id = (await add(project, "prototype/tests", "Sleep test", { data: { key: "t-sleep" } })).body.item.id;
  partId = (await add(project, "design/bom", "MCU", { data: { ref: "U1", key: "p-mcu" } })).body.item.id;
  reqId = (await add(project, "design/requirements", "Survives a drop")).body.item.id;
});

afterAll(async () => {
  await drop(project);
  await pool().end();
});

const links = async () => (await q<{ data: { tests?: string[]; parts?: string[] } }>("SELECT data FROM items WHERE id=$1", [reqId]))[0].data;

describe("validating links", () => {
  it("accepts keys that name a row in the right section", async () => {
    const r = await patch(reqId, { data: { tests: ["t-drop"], parts: ["p-mcu"] } });
    expect(r.status).toBe(200);
    expect(r.body.item.data).toMatchObject({ tests: ["t-drop"], parts: ["p-mcu"] });
  });

  it("refuses a key that names no row, with a sentence", async () => {
    const r = await patch(reqId, { data: { tests: ["t-drop", "t-nothing"] } });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('"t-nothing" names no acceptance test in this concept');
    expect(r.body.issues?.[0].field).toBe("data.tests");
    expect((await links()).tests).toEqual(["t-drop"]);
  });

  it("refuses a key that names a row in the wrong section", async () => {
    const r = await patch(reqId, { data: { parts: ["t-drop"] } });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('"t-drop" is not a part');
    expect(r.body.error).toContain("Design, Bill of materials");
  });

  it("refuses a key from another concept", async () => {
    const other = await newConcept("Links other");
    await add(other, "prototype/tests", "Foreign test", { data: { key: "t-foreign" } });
    const r = await patch(reqId, { data: { tests: ["t-foreign"] } });
    expect(r.status).toBe(400);
    await drop(other);
  });

  it("accepts a list written as one comma separated string, as older rows did", async () => {
    const r = await patch(reqId, { data: { tests: "t-drop, t-sleep" } });
    expect(r.status).toBe(200);
    expect((await links()).tests).toEqual(["t-drop", "t-sleep"]);
  });

  it("checks a new requirement too, on create", async () => {
    const bad = await add(project, "design/requirements", "New with a bad link", { data: { tests: ["t-none"] } });
    expect(bad.status).toBe(400);
    const good = await add(project, "design/requirements", "New with a link", { data: { tests: ["t-sleep"] } });
    expect(good.status).toBe(201);
  });

  it("checks the links of rows created with a concept", async () => {
    const make = (items: unknown[]) => createProject(json("POST", { name: `Links seeded ${Date.now()}-${Math.random()}`, items }));
    const bad = await make([{ section: "design/requirements", title: "R", data: { tests: ["t-x"] } }]);
    expect(bad.status).toBe(400);
    const ok = await read<{ project: { id: string } }>(
      await make([
        { section: "design/requirements", title: "R", data: { tests: ["t-x"] } },
        { section: "prototype/tests", title: "T", data: { key: "t-x" } },
      ])
    );
    expect(ok.status).toBe(201);
    await drop(ok.body.project.id);
  });
});

describe("keeping links whole", () => {
  it("deleting a linked test removes its key from every list that held it, in the same transaction", async () => {
    await patch(reqId, { data: { tests: ["t-drop", "t-sleep"], parts: ["p-mcu"] } });
    const build = await add(project, "prototype/builds", "EVT", { data: { tests: ["t-drop"] } });
    expect((await remove(testId)).status).toBe(200);
    expect((await links()).tests).toEqual(["t-sleep"]);
    expect((await links()).parts).toEqual(["p-mcu"]);
    expect((await q<{ data: { tests: string[] } }>("SELECT data FROM items WHERE id=$1", [build.body.item.id]))[0].data.tests).toEqual([]);
    // each holder's change is recorded with before and after, and the deletion names what it unlinked
    const ev = await events(project);
    const edit = ev.filter((e) => e.kind === "item.edited").find((e) => (e.data.before as Record<string, unknown>)?.["data.tests"]?.toString() === "t-drop,t-sleep");
    expect(edit?.data.after).toEqual({ "data.tests": ["t-sleep"] });
    const gone = ev.filter((e) => e.kind === "item.removed").at(-1)!;
    expect((gone.data.unlinked as { title: string }[]).map((u) => u.title).sort()).toEqual(["EVT", "Survives a drop"]);
  });

  it("deleting a linked part removes it from the requirement", async () => {
    expect((await remove(partId)).status).toBe(200);
    expect((await links()).parts).toEqual([]);
  });

  it("changing a row's key follows the links to the new key, and clearing the key unlinks", async () => {
    expect((await patch(test2Id, { data: { key: "t-sleep-2" } })).status).toBe(200);
    expect((await links()).tests).toEqual(["t-sleep-2"]);
    expect((await patch(test2Id, { data: { key: "" } })).status).toBe(200);
    expect((await links()).tests).toEqual([]);
  });

  it("a refused write leaves the links as they were", async () => {
    await patch(test2Id, { data: { key: "t-sleep-3" } });
    await patch(reqId, { data: { tests: ["t-sleep-3"] } });
    // a key another row already uses is a 409 and the transaction, including the rewrite, rolls back
    await add(project, "prototype/tests", "Taken", { data: { key: "t-taken" } });
    const r = await patch(test2Id, { data: { key: "t-taken" } });
    expect(r.status).toBe(409);
    expect((await links()).tests).toEqual(["t-sleep-3"]);
  });
});
