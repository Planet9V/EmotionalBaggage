// The rows a positioning's messages link to as proof, read from the database for the server's checks
// (the approval rule and the reviewer's attack). Only rows of this concept in a section proof may come from.
import type { PoolClient } from "pg";
import { q } from "@/lib/db";
import { PROOF_SECTIONS, type ProofRow } from "./proof";

type Row = { id: string; section: string; title: string; status: string; data: Record<string, unknown> | null };

export async function loadProofRows(c: Pick<PoolClient, "query"> | null, projectId: string, data: unknown): Promise<Map<number, ProofRow>> {
  const messages = (data as { messages?: unknown } | null)?.messages;
  const ids = (Array.isArray(messages) ? messages : [])
    .flatMap((m) => (Array.isArray((m as { proof?: unknown })?.proof) ? ((m as { proof: unknown[] }).proof) : []))
    .map((p) => (p as { itemId?: unknown })?.itemId)
    .filter((n): n is number => typeof n === "number" && Number.isInteger(n));
  if (!ids.length) return new Map();
  const sql = "SELECT id, section, title, status, data FROM items WHERE project_id=$1 AND id = ANY($2::bigint[]) AND section = ANY($3)";
  const args = [projectId, ids, [...PROOF_SECTIONS]];
  const rows = c ? (await c.query<Row>(sql, args)).rows : await q<Row>(sql, args);
  return new Map(rows.map((r) => [Number(r.id), { id: Number(r.id), section: r.section, title: r.title, status: r.status, data: r.data ?? {} }]));
}
