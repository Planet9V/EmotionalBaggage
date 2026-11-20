import { NextResponse } from "next/server";
import { logEvent, pool, q, ready, slugify } from "@/lib/db";

type Row = { id: string; name: string; one_liner: string };
const shape = (r: Row) => ({ id: r.id, name: r.name, oneLiner: r.one_liner });

export async function GET() {
  const rows = await q<Row>("SELECT id, name, one_liner FROM projects ORDER BY created_at");
  return NextResponse.json({ projects: rows.map(shape) });
}

type NewItem = { section: string; title: string; body?: string; data?: unknown; status?: string };

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { name?: string; oneLiner?: string; items?: NewItem[] };
  const name = (b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "A concept needs a name." }, { status: 400 });
  await ready();
  const base = slugify(name);
  const taken = await q<{ id: string }>("SELECT id FROM projects WHERE id = $1 OR id LIKE $2", [base, `${base}-%`]);
  const id = taken.length ? `${base}-${taken.length + 1}` : base;
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    await c.query("INSERT INTO projects (id, name, one_liner) VALUES ($1,$2,$3)", [id, name, (b.oneLiner ?? "").trim()]);
    const items = Array.isArray(b.items) ? b.items.filter((i) => i?.section && i?.title) : [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await c.query(
        "INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [id, it.section, it.title, it.body ?? "", JSON.stringify(it.data ?? {}), it.status ?? "open", i]
      );
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  await logEvent(id, "project.created", `Concept "${name}" created`);
  return NextResponse.json({ project: { id, name, oneLiner: (b.oneLiner ?? "").trim() } }, { status: 201 });
}
