"use client";

import { useMemo, useState } from "react";
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

/** Add a new step, or give an existing row a key so it joins the plan. */
export function AddStepForm({ items, steps, onAdd, onConvert }: Props) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [section, setSection] = useState(DEFAULT_STORE);
  const [itemId, setItemId] = useState("");
  const [after, setAfter] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const candidates = useMemo(() => items.filter((i) => !isStep(i)), [items]);
  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of candidates) m.set(i.section, [...(m.get(i.section) ?? []), i]);
    return [...m.entries()];
  }, [candidates]);

  const m = minutes.trim() === "" ? 0 : Number(minutes);
  const minutesOk = Number.isFinite(m) && m >= 0;
  const picked = candidates.find((i) => String(i.id) === itemId);
  const ready = mode === "new" ? title.trim() !== "" && minutesOk : !!picked && minutesOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const used = stepKeys(items);
      if (mode === "new") {
        const key = uniqueKey(title, used);
        await onAdd({ section, title: title.trim(), data: { key, after, minutes: m } });
        setTitle("");
      } else if (picked) {
        const key = uniqueKey(picked.title, used);
        await onConvert(picked.id, { key, after, minutes: m });
        setItemId("");
      }
      setMinutes("");
      setAfter([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-hairline bg-surface p-5">
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
              onClick={() => setMode(k)}
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
              <Input id="new-step-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" placeholder="What gets done" />
            </div>
            <div>
              <label htmlFor="new-step-section" className={labelCls}>Section</label>
              <NativeSelect id="new-step-section" value={section} onChange={(e) => setSection(e.target.value)} className="mt-1">
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
              <NativeSelect id="existing-item" value={itemId} onChange={(e) => setItemId(e.target.value)} className="mt-1">
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
          </div>
        )}
        <div>
          <label htmlFor="new-step-minutes" className={labelCls}>Minutes</label>
          <Input
            id="new-step-minutes"
            type="number"
            min={0}
            step={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="mt-1 font-mono"
            placeholder="0"
          />
        </div>
        <div className="md:col-span-2">
          <p className={labelCls}>Waits on</p>
          <WaitsOnPicker steps={steps} value={after} onChange={setAfter} />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={!ready || busy}>
          {busy ? "Saving" : mode === "new" ? "Add step" : "Make it a step"}
        </Button>
      </div>
    </form>
  );
}
