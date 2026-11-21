// Plan 3.7: a named build cannot be marked passed while a criterion is unmet or a linked test has not passed.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { add, drop, events, newConcept, patch, remove } from "./helpers";
import { buildProgress, lostEvidence, passRefusal } from "@/lib/trace/builds";

let project = "";
let t1 = 0;
let t2 = 0;
let evt = 0;

beforeAll(async () => {
  project = await newConcept("Builds probe");
  t1 = (await add(project, "prototype/tests", "Drop", { data: { key: "t1" } })).body.item.id;
  t2 = (await add(project, "prototype/tests", "Idle", { data: { key: "t2" } })).body.item.id;
  evt = (
    await add(project, "prototype/builds", "EVT", {
      body: "Prove the electronics work",
      data: { tests: ["t1", "t2"], criteria: [{ text: "Boots", met: true }, { text: "Plays a clip", met: false }], start: "2026-12-01", end: "2026-12-20" },
    })
  ).body.item.id;
});

afterAll(async () => {
  await drop(project);
  await pool().end();
});

describe("named builds", () => {
  it("is created in planned with its criteria, tests and dates", async () => {
    const r = await patch(evt, {});
    expect(r.status).toBe(400); // nothing to change is still refused by the route
    const b = await patch(evt, { body: "Prove the electronics work, on the bench" });
    expect(b.body.item.status).toBe("planned");
    expect(b.body.item.data).toMatchObject({ start: "2026-12-01", end: "2026-12-20", tests: ["t1", "t2"] });
  });

  it("refuses a status the section does not have and a date that is not a date", async () => {
    expect((await patch(evt, { status: "shipped" })).status).toBe(400);
    expect((await patch(evt, { data: { start: "next week" } })).status).toBe(400);
  });

  it("refuses Mark passed while a criterion is unmet, and says which and how many", async () => {
    const r = await patch(evt, { status: "passed" });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("1 of 2 exit criteria is not met");
    expect(r.body.error).toContain('"Plays a clip"');
  });

  it("refuses Mark passed while a linked test has not passed, even with every criterion met", async () => {
    await patch(evt, { data: { criteria: [{ text: "Boots", met: true }, { text: "Plays a clip", met: true }] } });
    const r = await patch(evt, { status: "passed" });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("2 of 2 tests have not passed");
    expect(r.body.error).toContain('"Drop", not run');
    await patch(t1, { status: "pass" });
    const one = await patch(evt, { status: "passed" });
    expect(one.body.error).toContain("1 of 2 tests has not passed");
    expect(one.body.error).toContain('"Idle"');
    await patch(t2, { status: "fail" });
    expect((await patch(evt, { status: "passed" })).status).toBe(400);
  });

  it("allows it once every criterion is met and every linked test passed", async () => {
    await patch(t2, { status: "pass" });
    const r = await patch(evt, { status: "passed" });
    expect(r.status).toBe(200);
    expect(r.body.item.status).toBe("passed");
  });

  it("refuses an edit that would leave a passed build with an unmet criterion", async () => {
    const r = await patch(evt, { data: { criteria: [{ text: "Boots", met: true }, { text: "Plays a clip", met: false }] } });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("cannot be marked passed");
  });

  it("refuses to create a build that is already passed when it does not qualify", async () => {
    expect((await add(project, "prototype/builds", "PVT", { status: "passed", data: { criteria: [{ text: "x", met: false }] } })).status).toBe(400);
  });

  it("refuses passed with no exit criterion or no linked test, in POST and in PATCH (process review 1)", async () => {
    const msg = "Add at least one exit criterion and one test before marking this build passed.";
    const empty = await add(project, "prototype/builds", "Empty", { status: "passed" });
    expect(empty.status).toBe(400);
    expect(empty.body.error).toContain(msg);
    // criteria but no tests, tests but no criteria
    expect((await add(project, "prototype/builds", "NoTests", { status: "passed", data: { criteria: [{ text: "x", met: true }] } })).body.error).toContain(msg);
    expect((await add(project, "prototype/builds", "NoCriteria", { status: "passed", data: { tests: ["t1"] } })).body.error).toContain(msg);
    const planned = (await add(project, "prototype/builds", "Planned")).body.item;
    const r = await patch(planned.id, { status: "passed" });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain(msg);
    // with both it passes (t1 and t2 passed above)
    const ok = await patch(planned.id, { status: "passed", data: { criteria: [{ text: "Boots", met: true }], tests: ["t1"] } });
    expect(ok.status).toBe(200);
  });

  it("failed and testing are never refused", async () => {
    expect((await patch(evt, { status: "failed" })).status).toBe(200);
    expect((await patch(evt, { status: "testing" })).status).toBe(200);
  });
});

describe("build progress, the same function the card and the server use", () => {
  const tests = [
    { title: "Drop", status: "pass", data: { key: "a" } },
    { title: "Idle", status: "not run", data: { key: "b" } },
  ];
  it("counts criteria and tests from the rows", () => {
    const p = buildProgress({ title: "EVT", status: "building", data: { tests: ["a", "b", "gone"], criteria: [{ text: "x", met: true }, { text: "y", met: false }, { text: "z", met: true }] } }, tests);
    expect(p.met).toBe(2);
    expect(p.criteria).toHaveLength(3);
    expect(p.testsDone).toBe(1);
    expect(p.linked.map((t) => t.title)).toEqual(["Drop", "Idle", null]);
    expect(p.blockers).toHaveLength(2);
  });
  it("a build with nothing to prove cannot pass", () => {
    expect(passRefusal({ title: "x", status: "planned", data: {} }, [])).toBe("Add at least one exit criterion and one test before marking this build passed.");
  });
  it("a build with a criterion and a passing test has no blockers", () => {
    expect(passRefusal({ title: "x", status: "planned", data: { criteria: [{ text: "a", met: true }], tests: ["a"] } }, tests)).toBeNull();
  });
  it("names a linked test that no longer exists", () => {
    expect(passRefusal({ title: "x", status: "planned", data: { tests: ["gone"] } }, [])).toContain("no longer exists");
  });
});

describe("a passed build reads live evidence (process review 2)", () => {
  let p2 = "";
  let tA = 0;
  let tB = 0;
  let b = 0;
  const statusLines = async () => (await events(p2)).filter((e) => e.kind === "item.status" && e.data.auto === true);
  beforeAll(async () => {
    p2 = await newConcept("Live evidence");
    tA = (await add(p2, "prototype/tests", "Drop test", { data: { key: "ta" }, status: "pass" })).body.item.id;
    tB = (await add(p2, "prototype/tests", "Idle test", { data: { key: "tb" }, status: "pass" })).body.item.id;
    b = (await add(p2, "prototype/builds", "EVT", { status: "passed", data: { tests: ["ta", "tb"], criteria: [{ text: "Boots", met: true }] } })).body.item.id;
  });
  afterAll(async () => {
    await drop(p2);
  });
  const reset = async () => {
    // put the world back: both tests pass, the build is passed with its evidence
    await patch(tA, { status: "pass" });
    await patch(tB, { status: "pass" });
    const bs = await q<{ status: string }>("SELECT status FROM items WHERE id=$1", [b]);
    if (bs[0].status !== "passed") await patch(b, { status: "passed", data: { tests: ["ta", "tb"], criteria: [{ text: "Boots", met: true }] } });
  };

  it("a linked test going to fail sends the build back to testing, in the same transaction, with the reason", async () => {
    const r = await patch(tA, { status: "fail" });
    expect(r.status).toBe(200);
    const row = (await q<{ status: string; data: Record<string, unknown> }>("SELECT status, data FROM items WHERE id=$1", [b]))[0];
    expect(row.status).toBe("testing");
    expect(row.data.revertedBecause).toContain("Drop test no longer passes (fail)");
    const lines = await statusLines();
    expect(lines).toHaveLength(1);
    expect(lines[0].summary).toContain('"EVT" moved from passed to testing: Drop test no longer passes');
    expect(lines[0].data.reason).toContain("Drop test no longer passes");
    // and the gate does not count it
    const again = await patch(b, { status: "passed" });
    expect(again.status).toBe(400);
  });

  it("passing it again clears the reason", async () => {
    await patch(tA, { status: "pass" });
    const ok = await patch(b, { status: "passed" });
    expect(ok.status).toBe(200);
    expect(ok.body.item.data.revertedBecause).toBe("");
  });

  it("deleting a linked test sends the build back and names the deleted test", async () => {
    await reset();
    expect((await remove(tB)).status).toBe(200);
    const row = (await q<{ status: string; data: Record<string, unknown> }>("SELECT status, data FROM items WHERE id=$1", [b]))[0];
    expect(row.status).toBe("testing");
    expect(row.data.revertedBecause).toContain("Idle test was deleted");
    tB = (await add(p2, "prototype/tests", "Idle test", { data: { key: "tb" }, status: "pass" })).body.item.id;
  });

  it("removing a test's key sends the build back too", async () => {
    await patch(b, { data: { tests: ["ta", "tb"] } });
    await reset();
    await patch(tB, { data: { key: "" } });
    const row = (await q<{ status: string; data: Record<string, unknown> }>("SELECT status, data FROM items WHERE id=$1", [b]))[0];
    expect(row.status).toBe("testing");
    expect(String(row.data.revertedBecause)).toContain("Idle test");
  });

  it("a passed build that gives up a linked test or an exit criterion in an edit goes back to testing", async () => {
    await patch(tB, { data: { key: "tb" } });
    await patch(b, { data: { tests: ["ta", "tb"] } });
    await reset();
    const r = await patch(b, { data: { tests: ["ta"] } });
    expect(r.status).toBe(200);
    expect(r.body.item.status).toBe("testing");
    expect(String(r.body.item.data.revertedBecause)).toContain("the test tb was unlinked");
    await patch(b, { data: { tests: ["ta", "tb"] }, status: "passed" });
    const c = await patch(b, { data: { criteria: [] } });
    expect(c.status).toBe(400); // zero criteria cannot stay passed: refused, not silently kept
  });

  it("the build card and the Process gate read the live evidence even for a stored passed build that lost it", async () => {
    const stale = { title: "Old", status: "passed", data: { tests: ["ta"], criteria: [{ text: "x", met: true }] } };
    expect(lostEvidence(stale, [{ title: "Drop test", status: "fail", data: { key: "ta" } }])).toEqual(["Drop test no longer passes (fail)"]);
    expect(lostEvidence(stale, [{ title: "Drop test", status: "pass", data: { key: "ta" } }])).toEqual([]);
    expect(lostEvidence({ ...stale, data: {} }, [])).toEqual(["it has no exit criterion and no linked test"]);
  });
});
