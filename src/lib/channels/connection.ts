// "Test connection" for the three channel providers in Admin, Credentials. Each makes one call with the
// saved values and answers { ok, message }; a failure is a normal answer. Messages never contain a secret.
import { amazonAccessToken, amazonCredentials, NOT_CONNECTED, resetAmazon } from "./amazon";
import { igCredentials, igMe, IG_NOT_CONNECTED } from "./instagram";
import { NOT_RUN_AGAINST_REAL } from "./status";
import { X_RATES } from "./xCost";
import { xMe } from "./x";
import { saveXAccount, xAccount } from "./state";

export type ChannelTestKind = "amazon-sp" | "x" | "instagram";
type Result = { ok: boolean; message: string; detail?: Record<string, unknown> };

const failed = (e: unknown): Result => ({ ok: false, message: e instanceof Error ? e.message : String(e) });

export async function testChannel(kind: ChannelTestKind): Promise<Result> {
  try {
    if (kind === "amazon-sp") {
      const creds = await amazonCredentials();
      if (!creds) return { ok: false, message: NOT_CONNECTED };
      resetAmazon(); // test the saved values, not a token cached from earlier ones
      await amazonAccessToken(creds);
      return {
        ok: true,
        message: "Login with Amazon accepted the refresh token, client ID and client secret and gave an access token (kept in memory only). Whether the app has the Inventory and Order Tracking role shows on the first Sync now.",
        detail: { note: NOT_RUN_AGAINST_REAL },
      };
    }
    if (kind === "x") {
      const me = await xMe();
      const acct = await xAccount();
      await saveXAccount({ userId: me.id, username: me.username, expiresAt: acct?.expiresAt ?? null, scope: acct?.scope ?? "", connectedAt: acct?.connectedAt ?? new Date().toISOString() });
      return { ok: true, message: `X answered for @${me.username}. X bills this read of your own account at $${X_RATES.userRead.toFixed(3)} per its pricing page.`, detail: { username: me.username } };
    }
    if (!(await igCredentials())) return { ok: false, message: IG_NOT_CONNECTED };
    const me = await igMe();
    return { ok: true, message: `Instagram answered for @${me.username || "unknown"} (account ${me.id}). Check that this is the account ID you saved.`, detail: { username: me.username, id: me.id } };
  } catch (e) {
    return failed(e);
  }
}
