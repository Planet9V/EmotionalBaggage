import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { HttpError, requireProject, route } from "@/lib/api/route";
import { buildSpec, enclosureOffered, validateSpec } from "@/lib/enclosure/spec";
import { withDefaults } from "@/lib/enclosure/validate";
import { runGenerator } from "@/lib/enclosure/run";
import { parseStl, writeBinaryStl } from "@/lib/enclosure/stl";
import { specFingerprint } from "@/lib/enclosure/fingerprint";
import { GENERATOR_KEYS, GENERATORS, type GeneratedMesh, type GeneratorKey } from "@/lib/enclosure/types";
import { ENCLOSURE_STORE } from "@/lib/process/computed";
import type { Item } from "@/lib/types";
import type { EnclosureChecked } from "@/lib/process/computed";
import { changedDetail, itemDiff } from "@/lib/trace/changes";

type Ctx = { params: Promise<{ id: string }> };

/** The concept frame is Y up; a slicer reads STL as Z up (file x, y, z = scene x, minus z, y). */
function toZUp(m: GeneratedMesh): GeneratedMesh {
  const p = new Float32Array(m.positions.length);
  for (let i = 0; i < p.length; i += 3) {
    p[i] = m.positions[i];
    p[i + 1] = -m.positions[i + 2];
    p[i + 2] = m.positions[i + 1];
  }
  return { positions: p, indices: m.indices };
}

/**
 * "Send to printing" on the Enclosure page: runs the saved generator on the saved settings and today's
 * parts, and stores the base and the lid (turned over for printing) as STL files of the concept, Z up,
 * where the print flow offers them for a new job. Nothing is sliced or sent here. Each file is recorded.
 */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const rows = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section = ANY($2) ORDER BY sort, id`, [id, ["design/bom", ENCLOSURE_STORE]])).map(toItem) as unknown as Item[];
  const saved = rows.find((r) => r.section === ENCLOSURE_STORE);
  const d = (saved?.data ?? {}) as { enclosureGenerator?: string; params?: Record<string, unknown> };
  const gen = (GENERATOR_KEYS as readonly string[]).includes(d.enclosureGenerator ?? "") ? (d.enclosureGenerator as GeneratorKey) : null;
  if (!saved || !gen) throw new HttpError(409, "Choose an enclosure generator on the Enclosure page first; its settings are saved there.");
  const bom = rows.filter((r) => r.section === "design/bom");
  if (!enclosureOffered(bom)) throw new HttpError(409, "No part has a box yet, so there is nothing to build an enclosure around. Place the parts in Physical layout first.");
  const spec = buildSpec({ items: bom, params: withDefaults(d.params) });
  const errors = validateSpec(spec).filter((i) => i.severity === "error");
  if (errors.length) throw new HttpError(409, `The enclosure cannot be generated yet: ${errors.map((e) => e.message).join(" ")}`);

  const r = await runGenerator(gen, spec);
  if (!r.ok) throw new HttpError(r.code === "failed" ? 502 : 503, `${GENERATORS[gen].label} could not build the enclosure: ${r.error}`);
  const failed = r.checks.filter((c) => !c.ok);
  const fingerprint = specFingerprint(spec);
  const pieces: { piece: "base" | "lid"; mesh: GeneratedMesh }[] = [
    { piece: "base", mesh: toZUp(parseStl(Buffer.from(r.baseStl, "base64"))) },
    { piece: "lid", mesh: toZUp(parseStl(Buffer.from(r.lidPrintStl, "base64"))) },
  ];
  const files = await tx(async (c) => {
    const out: { id: number; name: string; size: number }[] = [];
    for (const p of pieces) {
      const bytes = Buffer.from(writeBinaryStl(p.mesh, `enclosure ${p.piece}`));
      const sha = createHash("sha256").update(bytes).digest("hex");
      const name = `enclosure-${gen}-${p.piece}.stl`;
      const meta = { enclosure: true, piece: p.piece, generator: gen, fingerprint, zUp: true, checksFailed: failed.map((x) => x.label) };
      const res = await c.query<{ id: string }>(
        "INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,'model/stl','stl',$3,$4,$5,$6) RETURNING id",
        [id, name, bytes.length, sha, bytes, JSON.stringify(meta)]
      );
      const fileId = Number(res.rows[0].id);
      await logEventIn(c, id, "file.stored", `Stored ${name} from the ${GENERATORS[gen].label} enclosure for printing`, { fileId, sha256: sha, after: { name, kind: "stl", size: bytes.length, sha256: sha, piece: p.piece, generator: gen } });
      out.push({ id: fileId, name, size: bytes.length });
    }
    // the checks measured on this build are kept on the saved choice too, as the generate route keeps them, for the Design gate
    const was = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [saved.id])).rows[0];
    if (was) {
      const record: EnclosureChecked = { fingerprint, at: new Date().toISOString(), checks: r.checks.map((x) => ({ key: x.key, label: x.label, ok: x.ok, detail: x.detail })) };
      const prev = ((was.data ?? {}) as { checked?: Record<string, EnclosureChecked> }).checked ?? {};
      const now = (await c.query<ItemRow>(`UPDATE items SET data = data || jsonb_build_object('checked', $2::jsonb), updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [saved.id, JSON.stringify({ ...prev, [gen]: record })])).rows[0];
      await logEventIn(c, id, "enclosure.checked", `Measured the ${GENERATORS[gen].label} enclosure's checks while sending it to printing`, changedDetail(now, itemDiff(was, now)));
    }
    return out;
  });
  return NextResponse.json({ generator: gen, files, checks: r.checks, failed: failed.length }, { status: 201 });
});
