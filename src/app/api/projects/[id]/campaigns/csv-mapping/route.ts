import { NextResponse } from "next/server";
import { z } from "zod";
import { logEventIn, tx } from "@/lib/db";
import { body, requireProject, route } from "@/lib/api/route";
import { savedMapping } from "@/lib/campaigns/schemas";
import { getSetting } from "@/lib/settings";

type Ctx = { params: Promise<{ id: string }> };

const channel = z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/, "must be lower case letters, digits and hyphens");

const keyOf = (project: string, ch: string) => `campaigns.csv.${project}.${ch}`;

/** The column mapping last used for a channel's report, so the next file of that channel is mapped already. */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const ch = channel.parse(new URL(req.url).searchParams.get("channel") ?? "");
  const saved = await getSetting<unknown>(keyOf(id, ch), null);
  const parsed = savedMapping.safeParse(saved);
  return NextResponse.json({ channel: ch, saved: parsed.success ? parsed.data : null });
});

export const PUT = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const b = await body(req, z.object({ channel, saved: savedMapping }));
  await tx(async (c) => {
    const was = (await c.query<{ value: unknown }>("SELECT value FROM settings WHERE key=$1", [keyOf(id, b.channel)])).rows[0]?.value ?? null;
    await c.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()", [keyOf(id, b.channel), JSON.stringify(b.saved)]);
    await logEventIn(c, id, "campaign.csv-mapping", `Remembered the column mapping for ${b.channel} reports`, { channel: b.channel, columns: Object.keys(b.saved.mapping).length, before: { mapping: was }, after: { mapping: b.saved } });
  });
  return NextResponse.json({ channel: b.channel, saved: b.saved });
});
