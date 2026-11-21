// Runs one marketing generator: load the context, check it applies, ask the model for JSON,
// turn the answer into rows and save them as drafts with what they were generated from.
// The lead moves the generators onto the shared drafting engine later; only this file changes then.
import { completeJson, getReasoning } from "@/lib/ai/models";
import { ITEM_COLS, logEventIn, toItem, tx, type ItemRow } from "@/lib/db";
import { HttpError } from "@/lib/api/route";
import { loadContext } from "./context";
import { GENERATORS, type GeneratorId } from "./generators";

export type RunResult = {
  items: ReturnType<typeof toItem>[];
  /** what was dropped or changed on the way in, in plain sentences */
  notes: string[];
  model: string;
};

export async function runGenerator(
  project: { id: string; name: string; one_liner: string },
  id: GeneratorId,
  params: Record<string, unknown>,
  signal?: AbortSignal
): Promise<RunResult> {
  const { generator, toRows } = GENERATORS[id];
  const ctx = await loadContext(project, params);
  const ok = generator.applies(ctx);
  if (!ok.ok) throw new HttpError(409, ok.reason);
  const reasoning = await getReasoning();
  if (!reasoning.ok) throw new HttpError(503, reasoning.reason);

  const p = generator.buildPrompt(ctx);
  const res = await completeJson({
    use: reasoning,
    system: p.system,
    messages: [{ role: "user", content: p.prompt }],
    schema: generator.schema,
    maxOutputTokens: p.maxOutputTokens ?? 2000,
    temperature: 0.4,
    signal,
  });
  const model = res.info.model;
  const { rows, notes } = toRows(res.object, ctx, { model, at: new Date().toISOString() });

  const saved = await tx(async (c) => {
    const out: ItemRow[] = [];
    for (const r of rows) {
      const ins = await c.query<ItemRow>(
        `INSERT INTO items (project_id, section, title, body, data, status, sort)
         VALUES ($1,$2,$3,$4,$5,'draft',(SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1))
         RETURNING ${ITEM_COLS}`,
        [project.id, r.section, r.title.slice(0, 300), r.body.slice(0, 20_000), JSON.stringify(r.data)]
      );
      out.push(ins.rows[0]);
    }
    await logEventIn(c, project.id, "market.generated", `${generator.label}: ${out.length} draft${out.length === 1 ? "" : "s"} saved to ${generator.to}`, {
      generator: id,
      itemIds: out.map((r) => Number(r.id)),
      model,
      dropped: notes.length,
    });
    return out;
  });
  return { items: saved.map(toItem), notes, model };
}
