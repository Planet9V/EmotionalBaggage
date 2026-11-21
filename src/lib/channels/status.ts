// What the channel screens need to know about the three connections, in one answer.
// Nothing secret: whether values are present, the account name, the last sync, the cost statement.
import { credentialSource } from "@/lib/settings";
import { MARKETPLACES } from "./amazon";
import { amazonState, igReview, xAccount, xCostAck } from "./state";
import { X_COST_STATEMENT } from "./xCost";

export const NOT_RUN_AGAINST_REAL =
  "Built to the service's own documentation and tested against a stand-in written to it. Not yet run against the real service: press Test connection in Admin once your account exists.";

export type ChannelStatus = {
  note: string;
  amazon: {
    configured: boolean;
    marketplaceId: string | null;
    lastSyncAt: string | null;
    lastResult: { ok: boolean; message: string; at: string } | null;
    metrics: { day: string; units: number; orders: number; sales: number; currency: string }[];
    marketplaces: { id: string; name: string; currency: string }[];
  } | null;
  x: { configured: boolean; clientSaved: boolean; account: string | null; statement: typeof X_COST_STATEMENT; acknowledged: { by: string; at: string } | null };
  instagram: { configured: boolean; review: { ticks: Record<string, boolean>; updatedAt: string | null } };
};

const present = async (provider: "amazon-sp" | "x" | "instagram", fields: string[]) => (await Promise.all(fields.map((f) => credentialSource(provider, f)))).every((s) => s !== null);

export async function channelStatus(projectId: string | null): Promise<ChannelStatus> {
  const [amazonOk, xToken, xClient, igOk, acct, ack, review] = await Promise.all([
    present("amazon-sp", ["refreshToken", "clientId", "clientSecret"]),
    present("x", ["accessToken"]),
    present("x", ["clientId"]),
    present("instagram", ["accessToken", "accountId"]),
    xAccount(),
    xCostAck(),
    igReview(),
  ]);
  const st = projectId ? await amazonState(projectId) : null;
  return {
    note: NOT_RUN_AGAINST_REAL,
    amazon: st
      ? {
          configured: amazonOk,
          marketplaceId: st.marketplaceId,
          lastSyncAt: st.lastSyncAt,
          lastResult: st.lastResult,
          metrics: st.metrics,
          marketplaces: MARKETPLACES.map((m) => ({ id: m.id, name: m.name, currency: m.currency })),
        }
      : null,
    x: {
      configured: xToken,
      clientSaved: xClient,
      account: acct?.username ? `@${acct.username}` : null,
      statement: X_COST_STATEMENT,
      acknowledged: ack?.version === X_COST_STATEMENT.version ? { by: ack.by, at: ack.at } : null,
    },
    instagram: { configured: igOk, review: { ticks: review.ticks ?? {}, updatedAt: review.updatedAt } },
  };
}
