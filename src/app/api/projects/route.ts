import { NextResponse } from "next/server";
import { logEventIn, q, slugify, tx } from "@/lib/db";
import { body, HttpError, route } from "@/lib/api/route";
import { defaultStatus, newProject } from "@/lib/api/schemas";

type Row = { id: string; name: string; one_liner: string };
const shape = (r: Row) => ({ id: r.id, name: r.name, oneLiner: r.one_liner });

export const GET = route(async () => {
  const rows = await q<Row>("SELECT id, name, one_liner FROM projects ORDER BY created_at");
  return NextResponse.json({ projects: rows.map(shape) });
});

export const POST = route(async (req: Request) => {
  const b = await body(req, newProject);
  const oneLiner = b.oneLiner ?? "";
  const base = slugify(b.name);
  const id = await tx(async (c) => {
    // The first free id wins: "foo", then "foo-2", "foo-3"… The insert itself is the check,
    // so two people creating the same name at once cannot collide.
    let made: string | null = null;
    for (let n = 1; n <= 200 && !made; n++) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      const res = await c.query<{ id: string }>(
        "INSERT INTO projects (id, name, one_liner) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING RETURNING id",
        [candidate, b.name, oneLiner]
      );
      made = res.rows[0]?.id ?? null;
    }
    if (!made) throw new HttpError(409, "Too many concepts already use that name. Choose a different one.");
    const items = b.items ?? [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await c.query(
        "INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [made, it.section, it.title, it.body ?? "", JSON.stringify(it.data ?? {}), it.status ?? defaultStatus(it.section), i]
      );
    }
    await logEventIn(c, made, "project.created", `Concept "${b.name}" created`);
    return made;
  });
  return NextResponse.json({ project: { id, name: b.name, oneLiner } }, { status: 201 });
});
