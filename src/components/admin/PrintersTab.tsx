"use client";

// Printers: the form is built from the family definitions the API returns (fields, which are secret, which
// required, and whether the family can be tested today). Saved secrets show at most their last four.
import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { StatusTone } from "@/lib/statusTones";
import { messageOf } from "@/lib/queries";
import { httpUrlProblem } from "@/lib/admin/schemas";
import {
  useAddPrinter,
  useConnectionTest,
  usePrinterFamilies,
  usePrinters,
  useRemovePrinter,
  useUpdatePrinter,
  type PrinterFamily,
  type PrinterView,
} from "@/lib/admin/client";
import { ModelFacts } from "@/components/printers/ModelFacts";
import { ModelPicker } from "@/components/printers/ModelPicker";
import { findModel, type PrinterModel } from "@/lib/printers/models";
import { findModelFor } from "@/lib/printers/modelLookup";
import { TestOutcome } from "./shared";
import { SlicerAddress } from "./SlicerSection";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, describe } from "@/components/ui/field";
import { EmptyState, LoadError, LoadingBlocks, SaveError, SavedNote, useFlag } from "@/components/ui/states";
import { Panel } from "@/components/ui/panel";

/** What this app can do with a family today, in words. Shown on every family, honestly. */
export function familyStatus(f: Pick<PrinterFamily, "id" | "status" | "fields"> & { experimental?: boolean }): { label: string; tone: StatusTone; detail: string } {
  if (f.id === "file-only") return { label: "No connection needed", tone: "success", detail: "You download the file and print it yourself." };
  if (f.status === "supported" && f.experimental) {
    return { label: "Experimental", tone: "warning", detail: "A connection test and print status exist, built to documentation that may not match your model. Check it with Test before you rely on it." };
  }
  if (f.status === "supported") return { label: "Testable today", tone: "success", detail: "A connection test exists, print status is read, and files can be sent and started with a confirmation." };
  if (f.fields.length) return { label: "Saved but not driven", tone: "warning", detail: "It can be saved, but there is no connection test and nothing is sent to it yet." };
  return { label: "No documented fields", tone: "neutral", detail: "No connection documentation from the maker was found. Use File only for now." };
}

type Mode = { kind: "add" } | { kind: "edit"; printer: PrinterView };

function PrinterForm({ families, mode, onDone }: { families: PrinterFamily[]; mode: Mode; onDone: () => void }) {
  const editing = mode.kind === "edit" ? mode.printer : null;
  const uid = useId();
  const [name, setName] = useState(editing?.name ?? "");
  const [familyId, setFamilyId] = useState(editing?.family ?? "");
  const [model, setModel] = useState(editing?.model ?? "");
  const [modelId, setModelId] = useState(() => findModelFor(editing?.model ?? "")?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(editing?.access ?? {}).map(([k, v]) => [k, v.secret ? "" : (v.value ?? "")]))
  );
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const add = useAddPrinter();
  const update = useUpdatePrinter();
  const test = useConnectionTest();
  const fam = families.find((f) => f.id === familyId);
  const busy = add.isPending || update.isPending;
  const id = (f: string) => `${uid}-${f}`;
  const sameFamily = editing && editing.family === familyId;
  const picked = modelId ? findModel(modelId) : undefined;

  /** Choosing a model from the supported list sets the family and the model text; the fields below follow the family. */
  const pickModel = (m: PrinterModel | null) => {
    setModelId(m?.id ?? "__other");
    if (!m) return;
    if (m.family !== familyId) {
      setFamilyId(m.family);
      setErrors({});
      test.reset();
    }
    setModel(m.kind === "generic" ? "" : `${m.maker} ${m.model}`);
  };

  /** The access object to send: changed or new values, null for a value to remove. Blank secrets keep the saved one. */
  const access = (): Record<string, string | null> => {
    const out: Record<string, string | null> = {};
    for (const f of fam?.fields ?? []) {
      if (cleared.has(f.name)) {
        out[f.name] = null;
        continue;
      }
      const v = (values[f.name] ?? "").trim();
      if (!v) continue;
      const was = sameFamily ? editing!.access[f.name] : undefined;
      if (was && !was.secret && was.value === v) continue;
      out[f.name] = v;
    }
    return out;
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required.";
    if (!fam) e.family = "Choose a family.";
    for (const f of fam?.fields ?? []) {
      const v = (values[f.name] ?? "").trim();
      const savedSet = sameFamily && editing!.access[f.name]?.set && !cleared.has(f.name);
      if (f.required && !v && !savedSet) e[f.name] = `${f.label} is required for ${fam!.label}.`;
      if (v && f.kind === "url") {
        const p = httpUrlProblem(v);
        if (p) e[f.name] = `${f.label} ${p}.`;
      }
      if (v && f.kind === "host" && !/^[A-Za-z0-9.\-:[\]]+$/.test(v)) e[f.name] = `${f.label} must be a host name or IP address, with no http:// or path.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaveError("");
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, change: { name: name.trim(), family: familyId, model: model.trim(), access: access() } });
      } else {
        await add.mutateAsync({ name: name.trim(), family: familyId, model: model.trim(), access: access() });
      }
      onDone();
    } catch (err) {
      const m = messageOf(err);
      setSaveError(m);
      toast.error(m);
    }
  };

  const runTest = () => {
    if (!fam) return setErrors({ family: "Choose a family." });
    test.mutate(editing ? { kind: "printer", id: editing.id, family: familyId, access: access() } : { kind: "printer", family: familyId, access: access() });
  };

  const st = fam ? familyStatus(fam) : null;
  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-hairline bg-subtle p-4" aria-label={editing ? `Edit ${editing.name}` : "Add a printer"} aria-busy={busy || undefined}>
      <h3 className="text-sm font-semibold text-primary">{editing ? `Edit ${editing.name}` : "Add a printer"}</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field id={id("name")} label="Name" required error={errors.name}>
          <Input id={id("name")} value={name} onChange={(e) => setName(e.target.value)} {...describe(id("name"), { error: errors.name })} />
        </Field>
        <Field id={id("pick")} label="Model from the supported list" hint="Choosing one sets the family and shows what to switch on at the printer. Not on the list? Choose the family below.">
          <ModelPicker id={id("pick")} value={modelId} onPick={pickModel} />
        </Field>
        <Field id={id("family")} label="Family" required error={errors.family}>
          <Select
            value={familyId || undefined}
            onValueChange={(v) => {
              setFamilyId(v);
              setErrors({});
              test.reset();
            }}
          >
            <SelectTrigger id={id("family")} className="w-full border-hairline bg-surface" {...describe(id("family"), { error: errors.family })}>
              <SelectValue placeholder="Choose a family" />
            </SelectTrigger>
            <SelectContent>
              {families.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label} ({familyStatus(f).label.toLowerCase()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={id("model")} label="Printer model" hint="Optional, for your own reference.">
          <Input id={id("model")} value={model} onChange={(e) => setModel(e.target.value)} {...describe(id("model"), { hint: true })} />
        </Field>
      </div>

      {fam && st ? (
        <div className="space-y-3" data-testid="family-fields">
          <div className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
              <span className="text-secondary">{st.detail}</span>
            </p>
            {fam.notice ? <p className="mt-1 text-xs text-secondary" data-testid="family-notice">{fam.notice}</p> : null}
            <p className="mt-1 text-xs text-muted">At the printer: {fam.atPrinter}</p>
            <p className="mt-0.5 break-all text-xs text-muted">Field list from: {fam.source}</p>
          </div>
          {picked ? (
            <div className="rounded-md border border-hairline bg-surface px-3 py-3">
              <ModelFacts model={picked} />
            </div>
          ) : null}
          {fam.fields.length === 0 ? <p className="text-sm text-secondary">This family takes no connection fields.</p> : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {fam.fields.map((f) => {
              const fid = id(`f-${f.name}`);
              const saved = sameFamily ? editing!.access[f.name] : undefined;
              const isCleared = cleared.has(f.name);
              const state = saved?.set
                ? isCleared
                  ? "The saved value will be removed when you save."
                  : f.secret
                    ? saved.last4
                      ? `Saved, ending in ${saved.last4}. Leave empty to keep it.`
                      : "Saved. Leave empty to keep it."
                    : undefined
                : undefined;
              const hint = [f.hint, state].filter(Boolean).join(" ");
              return (
                <div key={f.name}>
                  <Field id={fid} label={f.label} required={f.required} error={errors[f.name]} hint={hint || undefined}>
                    <Input
                      id={fid}
                      name={f.name}
                      type={f.secret ? "password" : "text"}
                      autoComplete={f.secret ? "new-password" : "off"}
                      spellCheck={false}
                      disabled={isCleared}
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      {...describe(fid, { hint: !!hint, error: errors[f.name] })}
                    />
                  </Field>
                  {saved?.set && f.secret && !f.required ? (
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      className="px-0"
                      onClick={() =>
                        setCleared((c) => {
                          const n = new Set(c);
                          if (n.has(f.name)) n.delete(f.name);
                          else n.add(f.name);
                          return n;
                        })
                      }
                    >
                      {isCleared ? "Keep the saved value" : "Remove the saved value"}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <SaveError message={saveError} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Add printer"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!fam || test.isPending} onClick={runTest}>
          Test
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <TestOutcome result={test.data} error={test.isError ? messageOf(test.error) : ""} pending={test.isPending} />
    </form>
  );
}

function PrinterRow({ p, families }: { p: PrinterView; families: PrinterFamily[] }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [saved, markSaved] = useFlag();
  const update = useUpdatePrinter();
  const remove = useRemovePrinter();
  const test = useConnectionTest();
  const fam = families.find((f) => f.id === p.family);
  const st = familyStatus(fam ?? { id: p.family, status: p.status, fields: [] });
  const sw = `printer-${p.id}-enabled`;

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setError(m);
      toast.error(m);
    }
  };

  if (editing) return <PrinterForm families={families} mode={{ kind: "edit", printer: p }} onDone={() => setEditing(false)} />;

  const fields = Object.entries(p.access);
  return (
    <li className="space-y-3 rounded-xl border border-hairline p-4" data-testid={`printer-${p.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary">
            {p.name}
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            {!p.enabled ? <StatusBadge tone="neutral">Switched off</StatusBadge> : null}
          </p>
          <p className="mt-0.5 text-xs text-secondary">
            {p.familyLabel}
            {p.model ? `, ${p.model}` : ""}
          </p>
          {fields.length ? (
            <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-[auto_1fr]">
              {fields.map(([k, v]) => {
                const label = fam?.fields.find((f) => f.name === k)?.label ?? k;
                return (
                  <div key={k} className="contents">
                    <dt className="text-muted">{label}</dt>
                    <dd className="break-all font-mono text-primary">{!v.set ? "not set" : v.secret ? (v.last4 ? `set, ending in ${v.last4}` : "set") : v.value}</dd>
                  </div>
                );
              })}
            </dl>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Switch id={sw} checked={p.enabled} disabled={update.isPending} onCheckedChange={(v) => void run(() => update.mutateAsync({ id: p.id, change: { enabled: v } }))} />
          <label htmlFor={sw} className="text-xs text-secondary">
            {p.enabled ? "On" : "Off"}
          </label>
        </div>
      </div>
      <SaveError message={error} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={test.isPending} onClick={() => test.mutate({ kind: "printer", id: p.id })}>
          Test
        </Button>
        <ConfirmButton
          label="Remove"
          title={`Remove ${p.name}?`}
          body="The printer and its saved access values are deleted. The audit log keeps a line that it was removed."
          confirmLabel="Remove"
          disabled={remove.isPending}
          onConfirm={() => void run(() => remove.mutateAsync(p.id))}
        />
        <SavedNote show={saved} />
      </div>
      <TestOutcome result={test.data} error={test.isError ? messageOf(test.error) : ""} pending={test.isPending} />
    </li>
  );
}

export function PrintersTab() {
  const printers = usePrinters();
  const families = usePrinterFamilies();
  const [adding, setAdding] = useState(false);

  if (printers.isPending || families.isPending) return <LoadingBlocks rows={2} label="Reading the printers" />;
  if (families.isError) return <LoadError message={messageOf(families.error)} onRetry={() => void families.refetch()} />;
  if (printers.isError) return <LoadError message={messageOf(printers.error)} onRetry={() => void printers.refetch()} />;

  return (
    <div className="space-y-4">
      <SlicerAddress />
      <Panel
        title="Printers"
        description={
          <>
            Prototype, 3D printing shows every printer that is switched on, with its status, and Pause and Stop for a running print.{" "}
            <Link href="/printers" className="text-link underline underline-offset-2">Supported printers</Link>
          </>
        }
        actions={
          !adding ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add printer
            </Button>
          ) : null
        }
      >
        <div className="space-y-3">
          {adding ? <PrinterForm families={families.data} mode={{ kind: "add" }} onDone={() => setAdding(false)} /> : null}
          {printers.data.length === 0 && !adding ? (
            <EmptyState action={<Button size="sm" variant="outline" onClick={() => setAdding(true)}>Add printer</Button>}>
              No printers yet. Add one to see print progress here. Without one you can still download files and print by hand.
            </EmptyState>
          ) : null}
          {printers.data.length ? (
            <ul className="space-y-3">
              {printers.data.map((p) => (
                <PrinterRow key={p.id} p={p} families={families.data} />
              ))}
            </ul>
          ) : null}
        </div>
      </Panel>
      <Panel title="Families" description="What this app can do with each kind of printer today.">
        <ul className="divide-y divide-hairline rounded-xl border border-hairline">
          {families.data.map((f) => {
            const st = familyStatus(f);
            return (
              <li key={f.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-sm" data-testid={`family-${f.id}`}>
                <span className="w-48 shrink-0 font-medium text-primary">{f.label}</span>
                <span className="w-44 shrink-0">
                  <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                </span>
                <span className="min-w-0 flex-1 basis-64 text-xs text-secondary">{f.atPrinter}</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
