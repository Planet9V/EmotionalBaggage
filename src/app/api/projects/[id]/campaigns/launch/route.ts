import { NextResponse } from "next/server";
import { addedDetail } from "@/lib/trace/changes";
import { z } from "zod";
import { currentActor } from "@/lib/actor";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { body, HttpError, requireProject, route } from "@/lib/api/route";
import { DAY_RE, isDay } from "@/lib/campaigns/days";
import { instantiate, isLaunchRow, launchKeyFor, toLaunch } from "@/lib/campaigns/launch";
import { LAUNCH_STORE } from "@/lib/campaigns/schemas";
import { template } from "@/lib/campaigns/templates";

type Ctx = { params: Promise<{ id: string }> };

const make = z.object({
  template: z.string().min(1).max(60),
  launchDate: z.string().regex(DAY_RE, "must be a date like 2026-12-31").refine(isDay, "is not a real date"),
  title: z.string().trim().max(200).optional(),
});

/**
 * Starts a launch from a template: one launch row with its date and one row per step, in one
 * transaction. The steps are keyed rows (key, after, minutes), so the order-of-operations planner
 * places them. After this the rows are the user's to edit; the template is not read again.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const b = await body(req, make);
  const t = template(b.template);
  if (!t) throw new HttpError(400, `There is no launch template called "${b.template}".`);
  const created = await tx(async (c) => {
    // two launches made at once must not take the same key
    await c.query("SELECT 1 FROM projects WHERE id=$1 FOR UPDATE", [id]);
    const keys = await c.query<{ key: string }>("SELECT data->>'key' AS key FROM items WHERE project_id=$1 AND data ? 'key'", [id]);
    const launches = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2`, [id, LAUNCH_STORE])).rows.map(toItem).filter(isLaunchRow).map(toLaunch);
    const launchKey = launchKeyFor(t.channel, launches.map((l) => l.launchKey));
    const made = instantiate(t, { launchKey, launchDate: b.launchDate, title: b.title, usedKeys: new Set(keys.rows.map((r) => r.key)) });
    const ids: number[] = [];
    for (const row of [made.launch, ...made.steps]) {
      const r = await c.query<ItemRow>(
        `INSERT INTO items (project_id, section, title, body, data, status, sort)
         VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1)) RETURNING ${ITEM_COLS}`,
        [id, LAUNCH_STORE, row.title.slice(0, 300), row.body, JSON.stringify(row.data), row.status]
      );
      ids.push(Number(r.rows[0].id));
      // each row is recorded as added, with every field it starts with, so its History has its first line
      await logEventIn(c, id, "item.added", `Added "${r.rows[0].title}" to ${LAUNCH_STORE} from the ${t.label} template`, addedDetail(r.rows[0]));
    }
    await logEventIn(c, id, "launch.created", `Started the ${t.label} launch for ${b.launchDate} with ${made.steps.length} steps (by ${currentActor() ?? "someone"})`, { template: t.id, launchKey, launchDate: b.launchDate, steps: made.steps.length, launchItemId: ids[0], after: { launchKey, launchDate: b.launchDate, rows: ids.length } });
    return { launchKey, launchItemId: ids[0], steps: made.steps.length };
  });
  const rows = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 ORDER BY sort, id`, [id, LAUNCH_STORE])).map(toItem);
  return NextResponse.json({ ...created, items: rows }, { status: 201 });
});
