// How a tracked link row is read from the database and shaped for the screen. Kept out of the route file:
// a Next route file may export only its handlers.
import { shortPath } from "./links";

export type LinkDb = {
  id: string;
  campaign_id: string;
  creative_id: string | null;
  creative_label: string;
  base_url: string;
  destination: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  code: string | null;
  disabled: boolean;
  created_at: string;
  created_by: string;
  total: string | null;
};

export const LINK_SELECT = `SELECT l.id, l.campaign_id, l.creative_id, l.creative_label, l.base_url, l.destination, l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content, l.utm_term,
  l.code, l.disabled, l.created_at, l.created_by, (SELECT sum(clicks) FROM link_clicks WHERE link_id = l.id) AS total
  FROM tracked_links l`;

export const toLink = (r: LinkDb) => ({
  id: Number(r.id),
  campaignId: Number(r.campaign_id),
  creativeId: r.creative_id === null ? null : Number(r.creative_id),
  creativeLabel: r.creative_label,
  baseUrl: r.base_url,
  destination: r.destination,
  utm: { source: r.utm_source, medium: r.utm_medium, campaign: r.utm_campaign, content: r.utm_content, term: r.utm_term },
  code: r.code,
  shortPath: r.code ? shortPath(r.code) : null,
  disabled: r.disabled,
  createdAt: r.created_at,
  createdBy: r.created_by,
  clicks: Number(r.total ?? 0),
});

