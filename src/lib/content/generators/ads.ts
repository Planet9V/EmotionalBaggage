// 8.8 Ad variants, one generator per channel (the engine's button list is per target store, so the writer
// picks the channel by picking the generator). Each variant is tied to one approved message, written to the
// channel's field list, and checked against the channel's limits: a limit from the platform's own page drops
// the variant with the reason; a soft limit keeps it and says so.
import { z } from "zod";
import type { Generator } from "@/lib/ai/drafts/types";
import { clip } from "@/lib/ai/drafts/prompt";
import { AD_CHANNELS, checkChannel, refusals, type ChannelSpec, type FieldValues } from "../channels";
import { CONTENT } from "../schemas";
import { BASE_FROM, CONTENT_RULES, approvedMessages, blockedNoMessage, clean, commonRow, header, messagesBlock, proofBlock, resolve, voiceBlock, withProof } from "./shared";

const row = z.object({ ...commonRow, fields: z.record(z.string(), z.union([z.string(), z.array(z.string())])), stopRule: z.string().max(1000).optional() });
type Row = z.infer<typeof row>;

function fieldGuide(spec: ChannelSpec) {
  return spec.fields
    .map((f) => {
      const lim = [f.kind === "list" ? `${f.minItems ?? 1} to ${f.maxItems ?? 10} items` : "", f.max !== undefined ? `${f.kind === "list" ? "each " : ""}at most ${f.max} characters${f.enforce ? " (hard limit)" : " (guide)"}` : "", f.maxWords ? `at most ${f.maxWords} words` : "", f.choices ? `one of: ${f.choices.join(" | ")}` : "", f.kind === "url" ? "leave empty: the writer adds the address" : ""]
        .filter(Boolean)
        .join("; ");
      return `- "${f.key}" (${f.kind === "list" ? "array of strings" : "string"}${f.required ? ", required" : ""}): ${f.label}${lim ? `. ${lim}` : ""}${f.note ? `. ${f.note}` : ""}`;
    })
    .join("\n");
}

function adGenerator(spec: ChannelSpec): Generator<Row> {
  return {
    id: `ads-${spec.id}`,
    label: spec.label,
    action: `Draft ${spec.label} ads`,
    from: BASE_FROM,
    to: CONTENT.ads,
    kind: "section",
    applies: () => true,
    revises: false,
    blocked: blockedNoMessage,
    buildPrompt: (ctx) => ({
      system: [
        `You write ${spec.label} ad variants for a product. ${spec.summary}`,
        `Write 3 to 5 variants. Each variant is tied to one approved message; spread them over the messages when there is more than one. Vary the angle, not the facts.`,
        `Fields of one variant, in "fields":\n${fieldGuide(spec)}`,
        `Also give "stopRule": one plain sentence saying when to stop this ad and when to scale it, in terms of ${spec.costWord}. Do not put a number in it: the owner sets the numbers.`,
        CONTENT_RULES,
      ].join("\n\n"),
      user: [header(ctx), messagesBlock(ctx), proofBlock(ctx), voiceBlock(ctx)].join("\n\n"),
    }),
    schema: row,
    toDraft(r, ctx, run) {
      if (run.index >= 5) return { ok: false, reason: "only five variants are kept per run" };
      const res = resolve(ctx, r.messageId, r.proofIds);
      if (!res.ok) return res;
      const fields: FieldValues = {};
      for (const f of spec.fields) {
        const v = r.fields[f.key];
        if (f.kind === "url") continue;
        if (v === undefined) continue;
        fields[f.key] = Array.isArray(v) ? v.map(clean).filter(Boolean) : clean(v);
      }
      const problems = checkChannel(spec, fields, { forApproval: true });
      const hard = refusals(problems).filter((p) => spec.fields.find((f) => f.key === p.field)?.kind !== "url");
      if (hard.length) return { ok: false, reason: `over a limit from ${spec.platform}'s own page or incomplete: ${hard.map((h) => h.message).join(" ")}` };
      const first = spec.fields.find((f) => f.kind !== "url" && fields[f.key]);
      const lead = first ? (Array.isArray(fields[first.key]) ? (fields[first.key] as string[])[0] : String(fields[first.key])) : spec.label;
      const title = clip(`${spec.label}: ${lead}`, 120);
      const body = spec.fields
        .filter((f) => f.kind !== "url" && fields[f.key])
        .map((f) => `${f.label}: ${Array.isArray(fields[f.key]) ? (fields[f.key] as string[]).join(" | ") : fields[f.key]}`)
        .join("\n");
      const data = withProof(ctx, CONTENT.ads, title, body, { channel: spec.id, fields, stopRule: clean(r.stopRule ?? "") }, res.r);
      const soft = problems.filter((p) => p.level === "warn" && spec.fields.find((f) => f.key === p.field)?.kind !== "url");
      return { ok: true, drafts: [{ title, body, data, op: { op: "add" }, basedOn: r.basedOn }], notes: soft.map((s) => `${title.slice(0, 40)}: ${s.message}`) };
    },
  };
}

export const adGenerators = AD_CHANNELS.map(adGenerator);
