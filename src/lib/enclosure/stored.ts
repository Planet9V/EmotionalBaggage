// The enclosure files stored as concept files by "Save to concept" or "Send to printing", read back so the
// Enclosure page shows the last saved result after a reload. Server only.
import { q } from "@/lib/db";
import type { GeneratorKey } from "./types";

type StoredCheck = { key: string; label: string; ok: boolean; detail: string };

/** `meta` of a stored enclosure file. Z up, on z = 0; the lid turned over. */
export type StoredEnclosureMeta = {
  enclosure: true;
  piece: "base" | "lid" | "both";
  generator: GeneratorKey;
  fingerprint: string;
  /** the same eight hex digits as `fingerprint`: the settings, boxes and openings it was built from */
  paramsHash: string;
  zUp: true;
  at: string;
  checks: StoredCheck[];
  checksFailed: string[];
};

export type StoredEnclosure = {
  generator: GeneratorKey;
  paramsHash: string;
  at: string;
  checks: StoredCheck[];
  files: { id: number; name: string; piece: string; kind: string; size: number }[];
};

/** The newest stored set (base, lid, 3MF sharing one generator, hash and time), or null. */
export async function latestStoredEnclosure(projectId: string): Promise<StoredEnclosure | null> {
  const rows = await q<{ id: string; name: string; kind: string; size: number; meta: StoredEnclosureMeta }>(
    `SELECT id, name, kind, size, meta FROM files WHERE project_id=$1 AND meta->>'enclosure' = 'true' AND meta ? 'at' ORDER BY meta->>'at' DESC, id DESC LIMIT 12`,
    [projectId]
  );
  const head = rows[0];
  if (!head) return null;
  const m = head.meta;
  const set = rows.filter((r) => r.meta.at === m.at && r.meta.generator === m.generator && r.meta.fingerprint === m.fingerprint);
  const order = { base: 0, lid: 1, both: 2 } as Record<string, number>;
  return {
    generator: m.generator,
    paramsHash: m.paramsHash ?? m.fingerprint,
    at: m.at,
    checks: m.checks ?? [],
    files: set
      .map((r) => ({ id: Number(r.id), name: r.name, piece: r.meta.piece, kind: r.kind, size: Number(r.size) }))
      .sort((a, b) => (order[a.piece] ?? 9) - (order[b.piece] ?? 9)),
  };
}
