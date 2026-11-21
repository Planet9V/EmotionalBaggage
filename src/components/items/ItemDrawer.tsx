"use client";

import { keys } from "@/lib/domain";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryPanel } from "@/components/trace/HistoryPanel";
import { WhyField } from "@/components/trace/WhyField";
import { useItems } from "@/lib/client";
import { linkedFrom } from "@/lib/trace/coverage";
import type { Column } from "@/lib/menu";
import type { Item } from "@/lib/types";
import { ItemDialogShell } from "./ItemDialogShell";
import { Field } from "@/components/ui/field";
import { prim } from "./shared";
import { RowAssist } from "@/components/drafts/RowAssist";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Change = { title: string; body: string; status: string; data: Record<string, unknown>; why?: string };
type Restore = (id: number, change: Record<string, unknown>) => Promise<void>;

const afterText = (v: unknown) => keys(v).join(", ");

export function ItemDrawer({
  item,
  onClose,
  sectionLabel,
  columns,
  statuses,
  onSave,
  onDelete,
  onRestore,
  extra,
}: {
  item: Item | null;
  onClose: () => void;
  sectionLabel: string;
  columns: Column[];
  statuses: string[];
  onSave: (id: number, c: Change) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  /** puts one earlier value back as an ordinary save; with it the editor has a History tab */
  onRestore?: Restore;
  /** a section's own panel shown in the editor above the status, with its legend (claims show evidence) */
  extra?: { legend: string; render: (item: Item) => ReactNode };
}) {
  return (
    <ItemDialogShell
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      eyebrow={sectionLabel}
      title={item?.title || "Item"}
      description="Edit the fields and save, or delete the item."
    >
      {item && <DrawerBody key={item.id} item={item} columns={columns} statuses={statuses} onClose={onClose} onSave={onSave} onDelete={onDelete} onRestore={onRestore} extra={extra} />}
    </ItemDialogShell>
  );
}

/** The editor, and beside it the History tab. Both stay mounted once opened, so unsaved edits survive a look at the history. */
function DrawerBody(props: {
  item: Item;
  columns: Column[];
  statuses: string[];
  onClose: () => void;
  onSave: (id: number, c: Change) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onRestore?: Restore;
  extra?: { legend: string; render: (item: Item) => ReactNode };
}) {
  const { onRestore, ...form } = props;
  const [tab, setTab] = useState("edit");
  const [seenHistory, setSeenHistory] = useState(false);
  // A restored value must reach the form, or saving the form would put the old value back.
  const [revision, setRevision] = useState(0);
  if (!onRestore) return <EditForm {...form} />;
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v);
        if (v === "history") setSeenHistory(true);
      }}
      className="gap-0"
    >
      <TabsList variant="line" className="mx-5 mt-3">
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="edit" forceMount className="data-[state=inactive]:hidden">
        <EditForm key={revision} {...form} />
      </TabsContent>
      <TabsContent value="history" forceMount className="data-[state=inactive]:hidden">
        {seenHistory && (
          <HistoryPanel
            item={props.item}
            onRestore={async (id, change) => {
              await onRestore(id, change);
              setRevision((r) => r + 1);
            }}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

function EditForm({
  item,
  columns,
  statuses,
  onClose,
  onSave,
  onDelete,
  extra,
}: {
  item: Item;
  columns: Column[];
  statuses: string[];
  onClose: () => void;
  onSave: (id: number, c: Change) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  extra?: { legend: string; render: (item: Item) => ReactNode };
}) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  // Until the user picks a status, follow the row's own: evidence changed in the editor can move it.
  const [picked, setStatus] = useState<string | null>(null);
  const status = picked ?? item.status;
  // A status change can carry a reason; it is kept with the change in the history.
  const [why, setWhy] = useState("");
  const statusChanged = status !== item.status;
  const [cols, setCols] = useState<Record<string, string>>(() => Object.fromEntries(columns.map((c) => [c.key, prim(item.data[c.key])])));
  const [key, setKey] = useState(prim(item.data.key));
  const [minutes, setMinutes] = useState(prim(item.data.minutes));
  const [after, setAfter] = useState(afterText(item.data.after));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  // Rows that name this one in a list (a test in a requirement, a part in a requirement): deleting removes those links.
  const { items: all } = useItems(item.projectId, null);
  const holders = linkedFrom(all, item);

  const editable = (k: string) => {
    const v = item.data[k];
    return v === undefined || v === null || prim(v) !== "" || v === "";
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("The title cannot be empty.");
      return;
    }
    const mins = minutes.trim();
    if (mins && !Number.isFinite(Number(mins))) {
      setError("Minutes must be a number.");
      return;
    }
    const data: Record<string, unknown> = {};
    for (const c of columns) if (editable(c.key) && cols[c.key] !== prim(item.data[c.key])) data[c.key] = cols[c.key]!.trim();
    if (key.trim() !== prim(item.data.key)) data.key = key.trim();
    if (mins !== prim(item.data.minutes) && mins !== "") data.minutes = Number(mins);
    const cleanAfter = keys(after);
    if (cleanAfter.join(",") !== keys(item.data.after).join(",")) data.after = cleanAfter;
    setBusy(true);
    setError("");
    try {
      await onSave(item.id, { title: title.trim(), body, status, data, ...(statusChanged && why.trim() ? { why: why.trim() } : {}) });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    setError("");
    try {
      await onDelete(item.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 px-5 py-4" noValidate>
      <Field label="Title" id="edit-title">
        <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required aria-required />
      </Field>
      <Field label="Details" id="edit-body">
        <Textarea id="edit-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {columns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {columns.map((c) => (
            <Field key={c.key} label={c.label} id={`edit-${c.key}`} hint={editable(c.key) ? undefined : "Structured value, not editable here."}>
              <Input
                id={`edit-${c.key}`}
                value={cols[c.key] ?? ""}
                disabled={!editable(c.key)}
                onChange={(e) => setCols({ ...cols, [c.key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      )}
      {extra && (
        <fieldset className="space-y-2 rounded-xl border border-hairline bg-subtle p-4">
          <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-link">{extra.legend}</legend>
          {extra.render(item)}
        </fieldset>
      )}
      <Field label="Status" id="edit-status">
        <NativeSelect id="edit-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {(statuses.includes(status) ? statuses : [...statuses, status]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {statusChanged && <WhyField id="edit-why" value={why} onChange={setWhy} hint={`Optional. Kept with the move from ${item.status} to ${status}.`} />}

      <fieldset className="space-y-3 rounded-xl border border-hairline bg-subtle p-4">
        <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-link">Step in the order of operations</legend>
        <p className="text-xs leading-snug text-secondary">Give this row a key and a duration and it becomes a step in the plan. Leave the key empty to keep it out.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Key" id="edit-step-key" hint="Unique, short, for example p1.">
            <Input id="edit-step-key" value={key} onChange={(e) => setKey(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Minutes" id="edit-step-min">
            <Input id="edit-step-min" inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="font-mono" />
          </Field>
        </div>
        <Field label="After" id="edit-step-after" hint="Keys of the steps this one waits on, separated by commas.">
          <Input id="edit-step-after" value={after} onChange={(e) => setAfter(e.target.value)} className="font-mono" placeholder="p0, p2" />
        </Field>
      </fieldset>

      <RowAssist item={item} />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {confirming ? (
        <div role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-danger-soft p-3">
          <p className="text-sm text-danger">
            Delete this item for good?
            {holders.length > 0 && (
              <>
                {" "}
                It is linked from {holders.map((h) => `"${h.title}"`).join(", ")}; those links are removed with it.
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={busy} autoFocus>
              Keep it
            </Button>
            <Button type="button" size="sm" onClick={() => void del()} disabled={busy} className="bg-danger text-white hover:opacity-90">
              {busy ? "Deleting" : "Delete"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4">
          <Button type="button" variant="ghost" onClick={() => setConfirming(true)} disabled={busy} className="text-danger hover:text-danger">
            Delete
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
