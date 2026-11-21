"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/items/shared";
import { LinkPicker, type LinkOption } from "@/components/trace/LinkPicker";
import { useItems } from "@/lib/client";
import { STORE } from "@/lib/domain/schemas";
import { criteriaOf } from "@/lib/trace/builds";
import { freshKey } from "@/lib/trace/coverage";
import { keyOf, listOf } from "@/lib/trace/spec";
import type { Item } from "@/lib/types";

/**
 * What the build editor adds to the generic row editor: dates, exit criteria, and the tests the build must pass.
 * Each change here is saved at once as a normal save (so it is in the history).
 */
export function BuildPanel({ item, projectId }: { item: Item; projectId: string }) {
  const { items: all, patch } = useItems(projectId, null);
  const build = all.find((i) => i.id === item.id) ?? item;
  const criteria = criteriaOf(build.data);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (data: Record<string, unknown>) => {
    setError("");
    setBusy(true);
    try {
      await patch(item.id, { data });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addCriterion = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (await save({ criteria: [...criteria, { text: t, met: false }] })) setText("");
  };

  const tests: LinkOption[] = all
    .filter((i) => i.section === STORE.tests)
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map((i) => ({ id: i.id, key: keyOf(i.data) || null, label: i.title, hint: i.status }));

  const addTest = async (o: LinkOption) => {
    let key = o.key;
    if (!key) {
      const target = all.find((i) => i.id === o.id);
      if (!target) return;
      key = freshKey(all, target);
      try {
        await patch(target.id, { data: { key } });
      } catch (e) {
        setError(`${o.label} could not be given a key: ${(e as Error).message}`);
        return;
      }
    }
    await save({ tests: [...new Set([...listOf(build.data, "tests"), key])] });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["start", "end"] as const).map((k) => (
          <Field key={k} label={k === "start" ? "Start date" : "End date"} htmlFor={`build-${k}`}>
            <Input
              id={`build-${k}`}
              type="date"
              defaultValue={typeof build.data[k] === "string" ? (build.data[k] as string) : ""}
              onBlur={(e) => {
                if (e.target.value !== (typeof build.data[k] === "string" ? build.data[k] : "")) void save({ [k]: e.target.value });
              }}
            />
          </Field>
        ))}
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Exit criteria</p>
        {criteria.length > 0 && (
          <ul className="space-y-1" aria-label="Exit criteria">
            {criteria.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={c.met}
                  disabled={busy}
                  aria-label={`Met: ${c.text}`}
                  onChange={(e) => void save({ criteria: criteria.map((x, j) => (j === i ? { ...x, met: e.target.checked } : x)) })}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-dutchOrange"
                />
                <span className="flex-1 text-sm wrap-anywhere">{c.text}</span>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove criterion: ${c.text}`}
                  onClick={() => void save({ criteria: criteria.filter((_, j) => j !== i) })}
                  className="rounded p-0.5 text-muted hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {!criteria.length && <p className="text-xs text-muted">No exit criteria yet.</p>}
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} aria-label="New exit criterion" placeholder="For example: survives a 1 m drop" maxLength={300}
            onKeyDown={(e) => { if (e.key === "Enter") void addCriterion(e); }} />
          <Button type="button" variant="outline" onClick={(e) => void addCriterion(e as unknown as FormEvent)} disabled={busy || !text.trim()}>
            <Plus className="h-4 w-4" aria-hidden /> Add
          </Button>
        </div>
      </div>

      <LinkPicker
        label="Tests this build must pass"
        noun="test"
        options={tests}
        selected={listOf(build.data, "tests")}
        onAdd={addTest}
        onRemove={async (k) => { await save({ tests: listOf(build.data, "tests").filter((x) => x !== k) }); }}
        disabled={busy}
        emptyText="No acceptance test matches. Add tests in Prototype, Acceptance tests."
      />
      <p className="text-[11px] leading-snug text-muted">Marking the build passed is refused while a criterion is unmet or a linked test has not passed.</p>
      {error && (
        <p role="alert" className="text-sm text-danger wrap-anywhere">
          {error}
        </p>
      )}
    </div>
  );
}
