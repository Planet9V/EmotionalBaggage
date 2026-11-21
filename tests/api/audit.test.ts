// The install-wide audit log: every recorded change lands in it with who did it, and it outlives the concept.
import { describe, expect, it } from "vitest";
import { audit, q } from "@/lib/db";
import { POST as addProject } from "@/app/api/projects/route";
import { DELETE as deleteProject } from "@/app/api/projects/[id]/route";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { GET as readLog } from "@/app/api/admin/audit/route";
import { GET as exportLog } from "@/app/api/admin/audit/export/route";
import { anonymous, ctx, json, read } from "./helpers";

type Line = { id: number; actor: string; projectId: string; projectName: string; action: string; summary: string; detail: Record<string, unknown> };
type Page = { entries: Line[]; next: number | null; concepts: { id: string; name: string; exists: boolean }[] };
const log = async (query = "") => (await read<Page>(await readLog(json("GET", undefined, `http://test.local/api/admin/audit${query}`)))).body;

describe("audit log", () => {
  it("keeps a concept's history, and its deletion, after the concept is deleted", async () => {
    const name = `Audit probe ${Date.now()}`;
    const made = await read<{ project: { id: string } }>(await addProject(json("POST", { name, oneLiner: "for the audit test" })));
    expect(made.status).toBe(201);
    const id = made.body.project.id;
    expect((await addItem(json("POST", { section: "concept/brief", title: "A row that will go with the concept" }), ctx(id))).status).toBe(201);

    const before = await log(`?project=${id}`);
    expect(before.entries.map((e) => e.action)).toEqual(["item.added", "project.created"]);
    expect(before.entries.every((e) => e.actor === "demo" && e.projectName === name)).toBe(true);

    expect((await deleteProject(json("DELETE", { confirm: name }), ctx(id))).status).toBe(200);
    expect(await q("SELECT 1 FROM projects WHERE id=$1", [id])).toHaveLength(0);
    expect(await q("SELECT 1 FROM events WHERE project_id=$1", [id])).toHaveLength(0);

    const after = await log(`?project=${id}`);
    expect(after.entries.map((e) => e.action)).toEqual(["project.deleted", "item.added", "project.created"]);
    expect(after.entries[0]).toMatchObject({ actor: "demo", projectId: id, projectName: name });
    expect((after.entries[0].detail.counts as { items: number }).items).toBe(1);
    expect(after.concepts.find((c) => c.id === id)).toEqual({ id, name, exists: false });
  });

  it("pages newest first and filters by action and text", async () => {
    const all = await log("?limit=2");
    expect(all.entries).toHaveLength(2);
    expect(all.entries[0].id).toBeGreaterThan(all.entries[1].id);
    expect(all.next).toBe(all.entries[1].id);
    const older = await log(`?limit=2&before=${all.next}`);
    expect(older.entries.every((e) => e.id < all.next!)).toBe(true);
    const deleted = await log("?action=project.deleted");
    expect(deleted.entries.length).toBeGreaterThan(0);
    expect(deleted.entries.every((e) => e.action === "project.deleted")).toBe(true);
    expect((await log("?q=Audit%20probe")).entries.every((e) => /audit probe/i.test(e.summary + e.projectName))).toBe(true);
    expect((await readLog(json("GET", undefined, "http://test.local/api/admin/audit?limit=0"))).status).toBe(400);
  });

  it("hide leaves out sign-ins that started but keeps refused ones", async () => {
    const who = `hide-probe-${Date.now()}`;
    await audit({ action: "session.started", summary: `${who} signed in`, actor: who });
    await audit({ action: "session.refused", summary: `${who} was refused`, actor: "" });
    const shown = await log(`?q=${who}`);
    expect(shown.entries.map((e) => e.action).sort()).toEqual(["session.refused", "session.started"]);
    const hidden = await log(`?q=${who}&hide=session.started`);
    expect(hidden.entries.map((e) => e.action)).toEqual(["session.refused"]);
    expect((await log("?hide=session.started")).entries.some((e) => e.action === "session.started")).toBe(false);
  });

  it("refuses to change or remove a line, even from SQL, and keeps the line", async () => {
    await audit({ action: "audit.probe", summary: "append-only probe", actor: "probe" });
    const [line] = await q<{ id: string }>("SELECT id FROM audit_log WHERE action='audit.probe' ORDER BY id DESC LIMIT 1");
    await expect(q("UPDATE audit_log SET summary='changed' WHERE id=$1", [line.id])).rejects.toThrow(/append-only/);
    await expect(q("DELETE FROM audit_log WHERE id=$1", [line.id])).rejects.toThrow(/append-only/);
    await expect(q("DELETE FROM audit_log WHERE project_id='nothing-matches'")).resolves.toBeDefined();
    await expect(q("TRUNCATE audit_log")).rejects.toThrow(/cannot be truncated/);
    expect((await q<{ summary: string }>("SELECT summary FROM audit_log WHERE id=$1", [line.id]))[0].summary).toBe("append-only probe");
  });

  it("downloads as a file, one JSON object per line, oldest first, and records that it was taken", async () => {
    const res = await exportLog(json("GET", undefined, "http://test.local/api/admin/audit/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="audit-log-\d{4}-\d{2}-\d{2}\.ndjson"/);
    const lines = (await res.text()).trimEnd().split("\n").map((l) => JSON.parse(l) as Line);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines[0].id).toBeLessThan(lines[lines.length - 1].id);
    expect((await log("?limit=1")).entries[0].action).toBe("audit.exported");
  });

  it("needs a session, and nothing in the app can change or remove a line", async () => {
    expect((await readLog(anonymous("GET", undefined, "http://test.local/api/admin/audit"))).status).toBe(401);
    expect((await exportLog(anonymous("GET", undefined, "http://test.local/api/admin/audit/export"))).status).toBe(401);
    const mod = await import("@/app/api/admin/audit/route");
    expect(Object.keys(mod)).toEqual(["GET"]);
  });
});
