import { sha256 } from "@/lib/hash";
import { NextResponse } from "next/server";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { HttpError, requireProject, route } from "@/lib/api/route";
import { buildSpec, enclosureOffered, validateSpec } from "@/lib/enclosure/spec";
import { withDefaults } from "@/lib/enclosure/validate";
import { runEnclosureGenerator } from "@/lib/enclosure/run";
import { parseStl } from "@/lib/enclosure/stl";
import { piecesTo3mf } from "@/lib/enclosure/printFiles";
import { specFingerprint } from "@/lib/enclosure/fingerprint";
import { GENERATOR_KEYS, GENERATORS, type GeneratorKey } from "@/lib/enclosure/types";
import { ENCLOSURE_STORE } from "@/lib/process/computed";
import type { Item } from "@/lib/types";
import type { EnclosureChecked } from "@/lib/process/computed";
import { changedDetail, itemDiff } from "@/lib/trace/changes";
import { latestStoredEnclosure, type StoredEnclosureMeta } from "@/lib/enclosure/stored";

type Ctx = { params: Promise<{ id: string }> };

/** The enclosure files stored last, with the checks measured on that build; `stored` is null when none are. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  return NextResponse.json({ stored: await latestStoredEnclosure(id) });
});

/**
 * "Save to concept" and "Send to printing" on the Enclosure page: runs the saved generator on the saved
 * settings and today's parts, and stores the base and the lid as concept files, Z up and on z = 0 (the lid
 * turned over), as STL and as one 3MF holding both, named with the generator and the parameter hash (the
 * spec fingerprint). The print flow offers them first for a new job. Nothing is sliced or sent here. A file
 * of the same name (same generator, same inputs) is rebuilt in place, not stored twice. Each new file is recorded.
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

  const r = await runEnclosureGenerator(gen, spec);
  if (!r.ok) throw new HttpError(r.code === "failed" ? 502 : 503, `${GENERATORS[gen].label} could not build the enclosure: ${r.error}`);
  const failed = r.checks.filter((c) => !c.ok);
  const fingerprint = specFingerprint(spec);
  const at = new Date().toISOString();
  const base = parseStl(Buffer.from(r.basePrintStl, "base64"));
  const lid = parseStl(Buffer.from(r.lidPrintStl, "base64"));
  const stem = `enclosure-${gen}-${fingerprint}`;
  const both = await piecesTo3mf([{ name: `${stem}-base`, mesh: base }, { name: `${stem}-lid`, mesh: lid }], stem);
  const checks = r.checks.map((x) => ({ key: x.key, label: x.label, ok: x.ok, detail: x.detail }));
  const out: { piece: StoredEnclosureMeta["piece"]; name: string; mime: string; kind: string; bytes: Buffer }[] = [
    { piece: "base", name: `${stem}-base.stl`, mime: "model/stl", kind: "stl", bytes: Buffer.from(r.basePrintStl, "base64") },
    { piece: "lid", name: `${stem}-lid.stl`, mime: "model/stl", kind: "stl", bytes: Buffer.from(r.lidPrintStl, "base64") },
    { piece: "both", name: `${stem}.3mf`, mime: "model/3mf", kind: "3mf", bytes: Buffer.from(both) },
  ];
  const files = await tx(async (c) => {
    const stored: { id: number; name: string; size: number; piece: string }[] = [];
    for (const p of out) {
      const sha = sha256(p.bytes);
      const meta: StoredEnclosureMeta = { enclosure: true, piece: p.piece, generator: gen, fingerprint, paramsHash: fingerprint, zUp: true, at, checks, checksFailed: failed.map((x) => x.label) };
      // The name carries the generator and the parameter hash, so a file of the same name was built from the same inputs:
      // it is brought up to date in place rather than stored twice.
      const same = await c.query<{ id: string; sha256: string }>("SELECT id, sha256 FROM files WHERE project_id=$1 AND name=$2 AND meta->>'enclosure' = 'true' ORDER BY id DESC LIMIT 1", [id, p.name]);
      if (same.rows[0]) {
        const fileId = Number(same.rows[0].id);
        await c.query("UPDATE files SET bytes=$2, size=$3, sha256=$4, meta=$5 WHERE id=$1", [fileId, p.bytes, p.bytes.length, sha, JSON.stringify(meta)]);
        if (same.rows[0].sha256 !== sha) await logEventIn(c, id, "file.replaced", `Rebuilt ${p.name} from the ${GENERATORS[gen].label} enclosure`, { fileId, before: { sha256: same.rows[0].sha256 }, after: { sha256: sha, size: p.bytes.length } });
        stored.push({ id: fileId, name: p.name, size: p.bytes.length, piece: p.piece });
        continue;
      }
      const res = await c.query<{ id: string }>(
        "INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
        [id, p.name, p.mime, p.kind, p.bytes.length, sha, p.bytes, JSON.stringify(meta)]
      );
      const fileId = Number(res.rows[0].id);
      await logEventIn(c, id, "file.stored", `Stored ${p.name} from the ${GENERATORS[gen].label} enclosure for printing`, { fileId, sha256: sha, after: { name: p.name, kind: p.kind, size: p.bytes.length, sha256: sha, piece: p.piece, generator: gen, paramsHash: fingerprint } });
      stored.push({ id: fileId, name: p.name, size: p.bytes.length, piece: p.piece });
    }
    // the checks measured on this build are kept on the saved choice too, as the generate route keeps them, for the Design gate
    const was = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [saved.id])).rows[0];
    if (was) {
      const record: EnclosureChecked = { fingerprint, at, checks };
      const prev = ((was.data ?? {}) as { checked?: Record<string, EnclosureChecked> }).checked ?? {};
      const now = (await c.query<ItemRow>(`UPDATE items SET data = data || jsonb_build_object('checked', $2::jsonb), updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [saved.id, JSON.stringify({ ...prev, [gen]: record })])).rows[0];
      await logEventIn(c, id, "enclosure.checked", `Measured the ${GENERATORS[gen].label} enclosure's checks while sending it to printing`, changedDetail(now, itemDiff(was, now)));
    }
    return stored;
  });
  return NextResponse.json({ generator: gen, paramsHash: fingerprint, files, checks: r.checks, failed: failed.length }, { status: 201 });
});
