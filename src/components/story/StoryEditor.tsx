"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { statusesFor } from "@/lib/menuLookup";
import { CLAIM_BASES, STORY_STORE, type ClaimBasis, type StoryClaim, type StoryExample, type StoryPart } from "@/lib/story/parts";
import type { Item } from "@/lib/types";
import type { ItemChange, NewItem } from "@/lib/client";

const schema = z.object({
  body: z.string().max(20_000, "Keep a part under 20,000 characters."),
  status: z.string(),
  position: z.string().max(400, "Keep the position under 400 characters."),
  examples: z.string().max(30_000),
  claims: z.string().max(60_000),
  sourceIds: z.array(z.string()),
  why: z.string().max(1000),
});
type Values = z.infer<typeof schema>;

const BASIS_WORD: Record<string, ClaimBasis> = { sourced: "sourced", measured: "measured", assumption: "assumption", assumed: "assumption", test: "assumption" };

/** Examples as lines: "the line | when it is said". */
const examplesText = (xs: StoryExample[] = []) => xs.map((e) => (e.context ? `${e.text} | ${e.context}` : e.text)).join("\n");
function readExamples(text: string): StoryExample[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const at = l.lastIndexOf(" | ");
      return at > 0 ? { text: l.slice(0, at).trim(), context: l.slice(at + 3).trim() } : { text: l };
    });
}

/** Claims as lines: "basis | the claim | a note". A claim whose words did not change keeps the sources it cited. */
const claimsText = (xs: StoryClaim[] = []) => xs.map((c) => [c.basis, c.text, c.note ?? ""].join(" | ").replace(/ \| $/, "")).join("\n");
function readClaims(text: string, was: StoryClaim[] = []): StoryClaim[] | string {
  const out: StoryClaim[] = [];
  for (const [n, raw] of text.split("\n").entries()) {
    const l = raw.trim();
    if (!l) continue;
    const [b, t, ...note] = l.split(" | ");
    const basis = BASIS_WORD[(b ?? "").trim().toLowerCase()];
    if (!basis || !t?.trim()) return `Line ${n + 1} of the claims needs "sourced", "measured" or "assumption", then " | " and the claim.`;
    const prior = was.find((c) => c.text === t.trim());
    out.push({ text: t.trim(), basis, ...(note.join(" | ").trim() ? { note: note.join(" | ").trim() } : {}), ...(prior?.sourceIds?.length ? { sourceIds: prior.sourceIds } : {}) });
  }
  return out;
}

/** Writes or edits one part of the story. Every save is an ordinary row change, so it is in the row's history with the reason given. */
export function StoryEditor({
  part,
  item,
  sources,
  open,
  onOpenChange,
  add,
  patch,
}: {
  part: StoryPart;
  item: Item | undefined;
  sources: Item[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  add: (it: NewItem) => Promise<unknown>;
  patch: (id: number, change: ItemChange) => Promise<void>;
}) {
  const data = (item?.data ?? {}) as { position?: string; examples?: StoryExample[]; claims?: StoryClaim[]; sourceIds?: number[] };
  const statuses = statusesFor(STORY_STORE, item?.status);
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      body: item?.body ?? "",
      status: item?.status ?? "draft",
      position: data.position ?? "",
      examples: examplesText(data.examples),
      claims: claimsText(data.claims),
      sourceIds: (data.sourceIds ?? []).map(String),
      why: "",
    },
  });
  const id = (f: string) => `story-${part.key}-${f}`;

  const save = handleSubmit(async (v) => {
    const claims = part.key === "why" ? readClaims(v.claims, data.claims) : undefined;
    if (typeof claims === "string") {
      setError("claims", { message: claims });
      return;
    }
    const next: Record<string, unknown> = { ...(item?.data ?? {}), part: part.key, sourceIds: v.sourceIds.map(Number) };
    if (part.key === "positioning") next.position = v.position.trim();
    if (part.key === "voice") next.examples = readExamples(v.examples);
    if (claims) next.claims = claims;
    try {
      if (item) await patch(item.id, { body: v.body, status: v.status, data: next, ...(v.why.trim() ? { why: v.why.trim() } : {}) });
      else await add({ section: STORY_STORE, title: part.heading, body: v.body, status: v.status, data: next });
      onOpenChange(false);
    } catch (e) {
      setError("root", { message: (e as Error).message });
    }
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={item ? `Edit: ${part.heading}` : `Write: ${part.heading}`} description={part.covers} width="48rem">
      <form onSubmit={save} className="space-y-4 px-5 py-4" noValidate>
        <Field id={id("body")} label="Text" hint="Markdown: blank lines between paragraphs, - for a list, **bold**, | for a table." error={formState.errors.body?.message}>
          <Textarea id={id("body")} rows={14} className="font-mono text-[13px] leading-6" {...register("body")} />
        </Field>
        {part.key === "positioning" && (
          <Field id={id("position")} label="The one-line position" hint="Shown as a pull-out above the text." error={formState.errors.position?.message}>
            <Input id={id("position")} {...register("position")} />
          </Field>
        )}
        {part.key === "voice" && (
          <Field id={id("examples")} label="Examples, one per line" hint='The line, then " | " and when it is said: Are you calling me FAT? | At the scale' error={formState.errors.examples?.message}>
            <Textarea id={id("examples")} rows={8} className="text-[13px]" {...register("examples")} />
          </Field>
        )}
        {part.key === "why" && (
          <Field id={id("claims")} label="Claims, one per line" hint={`${CLAIM_BASES.join(", ")}, then " | " and the claim, then " | " and a note: sourced | Gag gifts sell for $12 to $15 | Stated in the source, not checked.`} error={formState.errors.claims?.message}>
            <Textarea id={id("claims")} rows={8} className="text-[13px]" {...register("claims")} />
          </Field>
        )}
        <fieldset>
          <legend className="mb-1 block text-xs font-medium text-secondary">Written from</legend>
          {sources.length ? (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-hairline p-2">
              {sources.map((s) => (
                <label key={s.id} className="flex items-start gap-2 text-sm text-primary">
                  <input type="checkbox" value={String(s.id)} className="mt-1 accent-dutchOrange" {...register("sourceIds")} />
                  <span className="min-w-0 break-words">{s.title}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No files yet. Files you add on the Files page can be ticked here.</p>
          )}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id("status")} label="Status">
            <NativeSelect id={id("status")} {...register("status")}>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field id={id("why")} label="Why (kept in the history)" error={formState.errors.why?.message}>
            <Input id={id("why")} autoComplete="off" {...register("why")} />
          </Field>
        </div>
        {formState.errors.root && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">The part was not saved: {formState.errors.root.message}</p>}
        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" size="sm" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Saving" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}
