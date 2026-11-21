// Small per-concept and per-install state of the channel connections, kept in the settings table:
// the Amazon marketplace chosen for a concept, when it was last synced and Amazon's own daily totals;
// the X cost statement the user acknowledged; the Instagram App Review checklist ticks.
// Never a token: tokens are credentials (src/lib/admin/credentials.ts) or live only in memory.
import { getSetting, setSetting } from "@/lib/settings";
import type { DayMetric } from "./amazon";

export type AmazonState = {
  marketplaceId: string | null;
  /** start time of the last sync that finished every page; the next sync reads orders updated since shortly before it */
  cursor: string | null;
  lastSyncAt: string | null;
  lastResult: { ok: boolean; message: string; at: string } | null;
  /** Amazon's own daily totals (Sales API), kept for comparison only; not sales monitor rows, so nothing is counted twice */
  metrics: DayMetric[];
};

const amazonKey = (projectId: string) => `channels.amazon:${projectId}`;
const EMPTY: AmazonState = { marketplaceId: null, cursor: null, lastSyncAt: null, lastResult: null, metrics: [] };

export async function amazonState(projectId: string): Promise<AmazonState> {
  const s = await getSetting<Partial<AmazonState> | null>(amazonKey(projectId), null);
  return { ...EMPTY, ...(s ?? {}), metrics: Array.isArray(s?.metrics) ? s.metrics : [] };
}

export async function saveAmazonState(projectId: string, next: AmazonState) {
  await setSetting(amazonKey(projectId), next);
}

export type XAccount = { userId: string; username: string; expiresAt: number | null; scope: string; connectedAt: string };
export const X_ACCOUNT = "channels.x.account";
export const xAccount = () => getSetting<XAccount | null>(X_ACCOUNT, null);
export const saveXAccount = (a: XAccount | null) => setSetting(X_ACCOUNT, a);

export type CostAck = { version: string; by: string; at: string };
export const X_COST_ACK = "channels.x.costAck";
export const xCostAck = () => getSetting<CostAck | null>(X_COST_ACK, null);

export const IG_REVIEW = "channels.instagram.review";
export type ReviewChecklist = { ticks: Record<string, boolean>; updatedAt: string | null; by: string | null };
export const igReview = () => getSetting<ReviewChecklist>(IG_REVIEW, { ticks: {}, updatedAt: null, by: null });
