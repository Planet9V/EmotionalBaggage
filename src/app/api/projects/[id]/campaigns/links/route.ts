import { NextResponse } from "next/server";
import { z } from "zod";
import { logEventIn, q, tx } from "@/lib/db";
import { body, HttpError, requireProject, route } from "@/lib/api/route";
import { buildUtmUrl, hostAllowed, makeCode, MEDIA, NOT_ON_LIST, slugify, UTM_CONVENTION } from "@/lib/campaigns/links";
import { linkHostsOf } from "@/lib/campaigns/server";
import { checkAddress } from "@/lib/net/outbound";
import { LINK_SELECT as SELECT, toLink, type LinkDb } from "@/lib/campaigns/linkRows";
import { requireCampaign, requireCreative } from "@/lib/campaigns/server";
import { currentActor } from "@/lib/actor";

type Ctx = { params: Promise<{ id: string }> };

const make = z.object({
  campaignId: z.number().int().positive(),
  creativeId: z.number().int().positive().nullable().optional(),
  baseUrl: z.string().trim().min(1, "is required").max(2000),
  source: z.string().trim().min(1, "is required").max(80),
  medium: z.enum(MEDIA, { message: `must be one of: ${MEDIA.join(", ")}` }),
  /** left out: the concept's name and the campaign's name */
  utmCampaign: z.string().trim().max(120).optional(),
  /** left out: the creative's name */
  utmContent: z.string().trim().max(120).optional(),
  utmTerm: z.string().trim().max(120).optional(),
  /** also make a short address served by this app */
  short: z.boolean().default(true),
});

/** Every tracked link of the concept with the clicks its short address counted, and the convention the UTM values follow. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const rows = await q<LinkDb>(`${SELECT} WHERE l.project_id=$1 ORDER BY l.id DESC`, [id]);
  return NextResponse.json({ links: rows.map(toLink), convention: UTM_CONVENTION });
});

/**
 * Makes a tracked link for a campaign, and for one of its creatives when given. The destination is
 * checked (http or https, no login in it) and built with the UTM parameters; the short address, when
 * asked for, only ever sends a visitor to this saved destination.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await requireProject(id);
  const b = await body(req, make);
  const campaign = await requireCampaign(id, b.campaignId);
  const creative = b.creativeId ? await requireCreative(null, id, b.creativeId) : null;
  const utmCampaign = b.utmCampaign || `${slugify(project.name, 28)}-${slugify(campaign.title, 28)}`.replace(/^-|-$/g, "");
  const built = buildUtmUrl(b.baseUrl, {
    source: b.source,
    medium: b.medium,
    campaign: utmCampaign,
    content: b.utmContent || (creative ? creative.title : undefined),
    term: b.utmTerm || undefined,
  });
  if (!built.ok) throw new HttpError(400, built.reason);
  // The host must be on the concept's allow-list and pass the outbound address rule (robustness review S5).
  const host = new URL(built.link.url).hostname;
  const allowed = await linkHostsOf(id);
  if (!hostAllowed(host, allowed)) throw new HttpError(400, NOT_ON_LIST, { host, allowed });
  const refused = await checkAddress(built.link.url);
  if (refused) throw new HttpError(400, `That address cannot be used: ${refused}.`);
  const p = built.link.params;
  const saved = await tx(async (c) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = b.short ? makeCode() : null;
      const r = await c.query<{ id: string }>(
        `INSERT INTO tracked_links (project_id, campaign_id, creative_id, creative_label, base_url, destination, utm_source, utm_medium, utm_campaign, utm_content, utm_term, code, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (code) DO NOTHING RETURNING id`,
        [id, b.campaignId, creative?.id ?? null, creative?.title ?? "", b.baseUrl.trim(), built.link.url, p.utm_source, p.utm_medium, p.utm_campaign, p.utm_content ?? "", p.utm_term ?? "", code, currentActor() ?? ""]
      );
      if (r.rows.length) {
        await logEventIn(c, id, "campaign.link", `Made a ${code ? "short link" : "UTM link"} for "${campaign.title}"${creative ? ` and "${creative.title}"` : ""}`, { linkId: Number(r.rows[0].id), campaignId: b.campaignId, creativeId: creative?.id ?? null, short: !!code });
        return Number(r.rows[0].id);
      }
    }
    throw new HttpError(500, "A short code could not be made. Try again.");
  });
  const rows = await q<LinkDb>(`${SELECT} WHERE l.id=$1`, [saved]);
  return NextResponse.json({ link: toLink(rows[0]), notes: built.link.notes }, { status: 201 });
});
