"use client";

import { useState } from "react";
import { useItems } from "@/lib/client";
import { freshKey } from "@/lib/trace/coverage";
import { keyOf, listOf } from "@/lib/trace/spec";
import { STORE } from "@/lib/domain/schemas";
import type { Item } from "@/lib/types";
import { LinkPicker, type LinkOption } from "./LinkPicker";

/**
 * The requirement editor's links: the acceptance tests that check it and the parts it needs, picked from
 * the concept's own rows. A pick is saved at once (a normal save, recorded in the history), like evidence on a claim.
 * A row with no key yet is given one first, because links are kept by key.
 */
export function RequirementLinks({ item, projectId }: { item: Item; projectId: string }) {
  const { items: all, patch } = useItems(projectId, null);
  const row = all.find((i) => i.id === item.id) ?? item;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const options = (section: string, hint: (i: Item) => string | undefined): LinkOption[] =>
    all.filter((i) => i.section === section).sort((a, b) => a.sort - b.sort || a.id - b.id).map((i) => ({ id: i.id, key: keyOf(i.data) || null, label: i.title, hint: hint(i) }));

  const save = async (field: "tests" | "parts", next: string[]) => {
    setError("");
    setSaving(true);
    try {
      await patch(item.id, { data: { [field]: next } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const add = (field: "tests" | "parts") => async (o: LinkOption) => {
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
    await save(field, [...new Set([...listOf(row.data, field), key])]);
  };
  const remove = (field: "tests" | "parts") => (key: string) => save(field, listOf(row.data, field).filter((k) => k !== key));

  return (
    <div className="space-y-3">
      <LinkPicker
        label="Acceptance tests"
        noun="test"
        options={options(STORE.tests, (i) => i.status)}
        selected={listOf(row.data, "tests")}
        onAdd={add("tests")}
        onRemove={remove("tests")}
        disabled={saving}
        emptyText="No acceptance test matches. Add tests in Prototype, Acceptance tests."
      />
      <LinkPicker
        label="Parts"
        noun="part"
        options={options(STORE.parts, (i) => (typeof i.data.ref === "string" ? i.data.ref : undefined))}
        selected={listOf(row.data, "parts")}
        onAdd={add("parts")}
        onRemove={remove("parts")}
        disabled={saving}
        emptyText="No part matches. Add parts in Design, Bill of materials."
      />
      <p className="text-[11px] leading-snug text-muted">A pick is saved at once. A test or part with no key is given one when you pick it.</p>
      {error && (
        <p role="alert" className="text-sm text-danger wrap-anywhere">
          {error}
        </p>
      )}
    </div>
  );
}
