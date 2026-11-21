// Pricing used to keep its own channel rows (marketing/pricing, kind "channel": one fee percent and one
// fixed fee in minor units). The sales channels (sales/channels) already hold the platform and payment
// fees the unit economics use, so Pricing now reads those. This moves what was typed on Pricing across,
// once per row, when the app starts; running it again finds nothing to move.
//
//  - a Pricing channel with no sales channel of that name (any case) becomes one, status "planned", its
//    fee as the platform fee;
//  - one that matches a sales channel with no platform fee entered fills that fee in;
//  - one that matches a sales channel whose platform fee is already entered loses to it (the economics
//    figure is the one used everywhere); the value dropped is written in the activity log.
// The Pricing row is deleted in the same transaction. Server only.
import type { Pool } from "pg";
import { toMajor } from "./money";

type Row = { id: string; project_id: string; title: string; data: Record<string, unknown>; currency: string };

export async function movePricingChannels(db: Pool): Promise<number> {
  const c = await db.connect();
  let moved = 0;
  try {
    await c.query("BEGIN");
    const { rows } = await c.query<Row>(
      `SELECT i.id, i.project_id, i.title, i.data, p.currency FROM items i JOIN projects p ON p.id = i.project_id
        WHERE i.section = 'marketing/pricing' AND i.data->>'kind' = 'channel' ORDER BY i.id FOR UPDATE OF i`,
    );
    for (const r of rows) {
      const percent = Number(r.data.feePercent ?? 0);
      const minor = Number(r.data.fixedFeeMinor ?? 0);
      const currency = String(r.data.currency || r.currency || "USD").toUpperCase();
      const fixed = toMajor(Number.isFinite(minor) ? minor : 0, currency);
      const fee = { platformPercent: Number.isFinite(percent) ? percent : 0, platformFixed: fixed };
      const match = await c.query<{ id: string; data: Record<string, unknown> }>(
        "SELECT id, data FROM items WHERE project_id=$1 AND section='sales/channels' AND lower(title)=lower($2) ORDER BY id LIMIT 1 FOR UPDATE",
        [r.project_id, r.title],
      );
      let summary: string;
      if (!match.rowCount) {
        await c.query(
          "INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,'sales/channels',$2,'',$3,'planned', COALESCE((SELECT max(sort)+1 FROM items WHERE project_id=$1 AND section='sales/channels'),0))",
          [r.project_id, r.title, JSON.stringify(fee)],
        );
        summary = `Moved the Pricing channel "${r.title}" to Sales channels (platform fee ${fee.platformPercent}% + ${fixed} ${currency}).`;
      } else {
        const d = match.rows[0].data ?? {};
        const has = (v: unknown) => v !== undefined && v !== null;
        const entered = has(d.platformPercent) || has(d.platformFixed);
        if (!entered) {
          await c.query("UPDATE items SET data = data || $2::jsonb, updated_at = now() WHERE id=$1", [match.rows[0].id, JSON.stringify(fee)]);
          summary = `Moved the fee of the Pricing channel "${r.title}" into the Sales channel of that name (platform fee ${fee.platformPercent}% + ${fixed} ${currency}).`;
        } else {
          summary = `The Pricing channel "${r.title}" (${fee.platformPercent}% + ${fixed} ${currency}) was dropped: the Sales channel of that name already has a platform fee (${String(d.platformPercent ?? 0)}% + ${String(d.platformFixed ?? 0)}), which is the one used.`;
        }
      }
      await c.query("DELETE FROM items WHERE id=$1", [r.id]);
      await c.query("INSERT INTO events (project_id, kind, summary) VALUES ($1,'pricing.channel.moved',$2)", [r.project_id, summary]);
      moved++;
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
  return moved;
}
