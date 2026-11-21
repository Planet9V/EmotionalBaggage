"use client";

import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Item, PlanNode } from "@/lib/types";
import { isStep, STORE_REFS, storeLabel, stepKeys, uniqueKey } from "./format";
import { WaitsOnPicker } from "./WaitsOnPicker";
import { NativeSelect } from "@/components/ui/native-select";

const DEFAULT_STORE = "prototype/assembly";

const labelCls = "font-mono text-[10px] uppercase tracking-[0.15em] text-muted";

type Props = {
  items: Item[];
  steps: PlanNode[];
  onAdd: (it: { section: string; title: string; data: Record<string, unknown> }) => Promise<void>;
  onConvert: (itemId: number, data: Record<string, unknown>) => Promise<void>;
};

const schema = z
  .object({ mode: z.enum(["new", "existing"]), title: z.string(), minutes: z.string(), section: z.string(), itemId: z.string(), after: z.array(z.string()) })
  .superRefine((v, ctx) => {
    const m = v.minutes.trim() === "" ? 0 : Number(v.minutes);
    if (v.mode === "new" && !v.title.trim()) ctx.addIssue({ code: "custom", path: ["title"], message: "Give the step a title." });
    if (v.mode === "existing" && !v.itemId) ctx.addIssue({ code: "custom", path: ["itemId"], message: "Choose the row to turn into a step." });
    if (!Number.isFinite(m) || m < 0) ctx.addIssue({ code: "custom", path: ["minutes"], message: "Minutes are a number, zero or more." });
  });
type Values = z.infer<typeof schema>;

/** Add a new step, or give an existing row a key so it joins the plan. */
export function AddStepForm({ items, steps, onAdd, onConvert }: Props) {
  const { register, handleSubmit, control, setValue, reset, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { mode: "new", title: "", minutes: "", section: DEFAULT_STORE, itemId: "", after: [] },
  });
  const mode = useWatch({ control, name: "mode" });
  const after = useWatch({ control, name: "after" });

  const candidates = useMemo(() => items.filter((i) => !isStep(i)), [items]);
  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of candidates) m.set(i.section, [...(m.get(i.section) ?? []), i]);
    return [...m.entries()];
  }, [candidates]);

  const submit = handleSubmit(async (v) => {
    const m = v.minutes.trim() === "" ? 0 : Number(v.minutes);
    const picked = candidates.find((i) => String(i.id) === v.itemId);
    try {
      const used = stepKeys(items);
      if (v.mode === "new") {
        const key = uniqueKey(v.title, used);
        await onAdd({ section: v.section, title: v.title.trim(), data: { key, after: v.after, minutes: m } });
      } else if (picked) {
        const key = uniqueKey(picked.title, used);
        await onConvert(picked.id, { key, after: v.after, minutes: m });
      }
      reset({ ...v, title: "", itemId: "", minutes: "", after: [] });
    } catch (err) {
      setError("root", { message: (err as Error).message });
    }
  });

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="rounded-xl border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-primary">Add step</h2>
        <div role="tablist" aria-label="Kind of step" className="inline-flex rounded-md border border-hairline bg-canvas p-0.5">
          {(
            [
              ["new", "New step"],
              ["existing", "From an existing row"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              onClick={() => setValue("mode", k)}
              className={`rounded px-2.5 py-1 text-xs transition-colors duration-150 ${
                mode === k ? "bg-surface font-semibold text-primary shadow-xs" : "text-secondary hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {mode === "new" ? (
          <>
            <div className="md:col-span-2">
              <label htmlFor="new-step-title" className={labelCls}>Title</label>
              <Input id="new-step-title" className="mt-1" placeholder="What gets done" aria-invalid={!!errors.title} aria-describedby={errors.title ? "new-step-title-error" : undefined} {...register("title")} />
              {errors.title && <p id="new-step-title-error" role="alert" className="mt-1 text-xs text-danger">{errors.title.message}</p>}
            </div>
            <div>
              <label htmlFor="new-step-section" className={labelCls}>Section</label>
              <NativeSelect id="new-step-section" className="mt-1" {...register("section")}>
                {STORE_REFS.map((r) => (
                  <option key={r.store} value={r.store}>{storeLabel(r.store)}</option>
                ))}
              </NativeSelect>
            </div>
          </>
        ) : (
          <div className="md:col-span-2">
            <label htmlFor="existing-item" className={labelCls}>Row</label>
            {candidates.length ? (
              <NativeSelect id="existing-item" className="mt-1" aria-invalid={!!errors.itemId} aria-describedby={errors.itemId ? "existing-item-error" : undefined} {...register("itemId")}>
                <option value="">Choose a row that is not a step yet</option>
                {grouped.map(([store, list]) => (
                  <optgroup key={store} label={storeLabel(store)}>
                    {list.map((i) => (
                      <option key={i.id} value={i.id}>{i.title}</option>
                    ))}
                  </optgroup>
                ))}
              </NativeSelect>
            ) : (
              <p className="mt-1 text-sm text-muted">Every row in this concept is already a step.</p>
            )}
            {errors.itemId && <p id="existing-item-error" role="alert" className="mt-1 text-xs text-danger">{errors.itemId.message}</p>}
          </div>
        )}
        <div>
          <label htmlFor="new-step-minutes" className={labelCls}>Minutes</label>
          <Input
            id="new-step-minutes"
            type="number"
            min={0}
            step={1}
            className="mt-1 font-mono"
            placeholder="0"
            aria-invalid={!!errors.minutes}
            aria-describedby={errors.minutes ? "new-step-minutes-error" : undefined}
            {...register("minutes")}
          />
          {errors.minutes && <p id="new-step-minutes-error" role="alert" className="mt-1 text-xs text-danger">{errors.minutes.message}</p>}
        </div>
        <div className="md:col-span-2">
          <p className={labelCls}>Waits on</p>
          <WaitsOnPicker steps={steps} value={after} onChange={(v) => setValue("after", v)} />
        </div>
      </div>

      {errors.root?.message && <p className="mt-3 text-sm text-danger" role="alert">{errors.root.message}</p>}
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving" : mode === "new" ? "Add step" : "Make it a step"}
        </Button>
      </div>
    </form>
  );
}
