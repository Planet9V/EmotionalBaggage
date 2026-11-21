"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Item } from "@/lib/types";
import { BUSES, BUS_TYPES, CATEGORIES, PART_KINDS, PIN_KIND_LABEL, PIN_KINDS, SIDES, partKind, type BusType, type PinKind, type Side } from "@/lib/parts/kinds";
import { LIBRARY, libraryEntryById } from "@/lib/parts/library";
import { partPins, pinToDef, type PinRow } from "@/lib/parts/pins";
import { pinList, type PinDef } from "@/lib/parts/schema";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Modal } from "@/components/ui/modal";

type Props = {
  part: Item | null;
  ownPins: PinRow[];
  onClose: () => void;
  /** sets data.kind and data.library on the part row */
  onType: (change: { kind?: string; library?: string }) => Promise<void>;
  /** replaces the part's own pins; [] goes back to the library entry's or kind's */
  onPins: (pins: PinDef[]) => Promise<void>;
};

type Draft = { name: string; kind: PinKind | ""; side: Side | ""; vmin: string; vmax: string; vnom: string; imax: string; bus: string; optional: boolean; pullUp: boolean; rest: Partial<PinDef> };

const toDraft = (p: PinDef): Draft => ({
  name: p.name,
  kind: p.kind ?? "",
  side: p.side ?? "",
  vmin: p.voltage?.min?.toString() ?? "",
  vmax: p.voltage?.max?.toString() ?? "",
  vnom: p.voltage?.nominal?.toString() ?? "",
  imax: p.current?.max?.toString() ?? "",
  bus: p.bus ? `${p.bus.type}:${p.bus.line}` : "",
  optional: !!p.optional,
  pullUp: !!p.pullUp,
  rest: { number: p.number, position: p.position, analog: p.analog },
});

const n = (s: string) => (s.trim() === "" ? undefined : Number(s));

function fromDraft(d: Draft): PinDef {
  const out: PinDef = { name: d.name.trim(), kind: d.kind || null };
  if (d.side) out.side = d.side;
  const [min, max, nominal] = [n(d.vmin), n(d.vmax), n(d.vnom)];
  if (min !== undefined || max !== undefined || nominal !== undefined) out.voltage = { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(nominal !== undefined ? { nominal } : {}) };
  const imax = n(d.imax);
  if (imax !== undefined) out.current = { max: imax };
  if (d.bus) {
    const [type, line] = d.bus.split(":");
    out.bus = { type: type as BusType, line };
  }
  if (d.optional) out.optional = true;
  if (d.pullUp) out.pullUp = true;
  if (d.rest.number) out.number = d.rest.number;
  if (d.rest.position) out.position = d.rest.position;
  if (d.rest.analog) out.analog = true;
  return out;
}

const BUS_OPTIONS = BUS_TYPES.flatMap((t) => BUSES[t].lines.map((l) => ({ value: `${t}:${l}`, label: `${BUSES[t].label} ${l}` })));

/** The parts list's kind, library entry and pin editing (plan 5.1). */
export function PartElectricalDialog({ part, ownPins, onClose, onType, onPins }: Props) {
  return (
    <Modal open={!!part} onOpenChange={(o) => !o && onClose()} title={part ? `Kind and pins of ${part.title}` : "Kind and pins"} description="The kind picks the symbol and default pins. A library entry gives real pin names, positions and, where a source states them, voltages. Pins you set here win over both." wide>
      {part ? <Body key={part.id} part={part} ownPins={ownPins} onClose={onClose} onType={onType} onPins={onPins} /> : null}
    </Modal>
  );
}

function Body({ part, ownPins, onClose, onType, onPins }: Props & { part: Item }) {
  const resolved = useMemo(() => partPins(part, ownPins), [part, ownPins]);
  const [kind, setKind] = useState(typeof part.data.kind === "string" ? part.data.kind : "");
  const [library, setLibrary] = useState(typeof part.data.library === "string" ? part.data.library : "");
  const [drafts, setDrafts] = useState<Draft[] | null>(resolved.source === "own" ? resolved.pins.map((p) => toDraft(pinToDef(p))) : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lib = libraryEntryById(library);
  const typeChanged = kind !== (part.data.kind ?? "") || library !== (part.data.library ?? "");

  const entries = useMemo(() => {
    const k = partKind(kind);
    return LIBRARY.filter((e) => !k || e.kind === k.id || partKind(e.kind)?.category === k.category);
  }, [kind]);

  const set = (i: number, change: Partial<Draft>) => setDrafts((ds) => (ds ?? []).map((d, j) => (j === i ? { ...d, ...change } : d)));

  const saveType = async () => {
    setError("");
    setBusy(true);
    try {
      await onType({ kind, library });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const savePins = async () => {
    if (!drafts) return;
    const pins = drafts.map(fromDraft);
    const checked = pinList.safeParse(pins);
    if (!checked.success) {
      const issue = checked.error.issues[0];
      const row = typeof issue.path[0] === "number" ? ` (pin ${issue.path[0] + 1})` : "";
      return setError(`${issue.message}${row}.`);
    }
    if (pins.some((p) => [p.voltage?.min, p.voltage?.max, p.voltage?.nominal, p.current?.max].some((v) => v !== undefined && !Number.isFinite(v)))) return setError("Voltages and currents must be numbers.");
    setError("");
    setBusy(true);
    try {
      await onPins(checked.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    setBusy(true);
    setError("");
    try {
      await onPins([]);
      setDrafts(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sourceText =
    resolved.source === "own"
      ? "This part has its own pins."
      : resolved.source === "library"
        ? `The pins come from the library entry ${libraryEntryById(resolved.libraryId)?.name}.`
        : resolved.source === "kind"
          ? `The pins are the default pins of a ${partKind(resolved.kindId)?.label.toLowerCase()}.`
          : "Nobody has described this part yet: its pins are the names its wires use.";

  return (
    <div className="space-y-5">
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Kind">
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
            <option value="">Not set</option>
            {CATEGORIES.map((c) => (
              <optgroup key={c} label={c}>
                {PART_KINDS.filter((k) => k.category === c).map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Library entry" hint={entries.length < LIBRARY.length ? "Entries of the same kind of part." : undefined}>
          <NativeSelect
            value={library}
            onChange={(e) => {
              setLibrary(e.target.value);
              const entry = libraryEntryById(e.target.value);
              if (entry && !kind) setKind(entry.kind);
            }}
            aria-label="Library entry"
          >
            <option value="">None</option>
            {entries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {lib && (
          <div className="rounded-md border border-hairline bg-subtle p-3 text-xs text-secondary sm:col-span-2">
            <p className="text-primary">{lib.description}</p>
            <p className="mt-1">
              {lib.pins.length} pins. Size {lib.size.w} by {lib.size.d} mm ({lib.basis === "doc" ? "from a drawing" : "typical"}).
            </p>
            {lib.figures && <p className="mt-1">{lib.figures}</p>}
            {lib.note && <p className="mt-1">{lib.note}</p>}
            {lib.sources.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {lib.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-link hover:underline">
                      {s.label} <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1">No electrical figures are stated for this entry: none could be sourced.</p>
            )}
          </div>
        )}
        <div className="sm:col-span-2">
          <Button size="sm" onClick={saveType} disabled={!typeChanged || busy}>
            {busy && typeChanged ? "Saving" : "Save kind and entry"}
          </Button>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-primary">Pins</h3>
            <p className="text-xs text-secondary">{sourceText}</p>
          </div>
          {drafts === null ? (
            <Button size="sm" variant="outline" onClick={() => setDrafts(resolved.pins.map((p) => toDraft(pinToDef(p))))}>
              {resolved.pins.length ? "Change these pins" : "Add pins"}
            </Button>
          ) : resolved.source === "own" ? (
            <Button size="sm" variant="ghost" onClick={revert} disabled={busy}>
              Use the {libraryEntryById(resolved.libraryId) ? "library entry's" : "kind's"} pins instead
            </Button>
          ) : null}
        </div>

        {drafts === null ? (
          resolved.pins.length ? (
            <ul className="mt-2 grid gap-1 font-mono text-[11px] text-secondary sm:grid-cols-3">
              {resolved.pins.map((p) => (
                <li key={p.name} className="truncate">
                  <span className="text-primary">{p.name}</span> {p.kind ? PIN_KIND_LABEL[p.kind].toLowerCase() : "kind not stated"}
                  {p.voltage ? ` · ${[p.voltage.min, p.voltage.max].some((v) => v !== undefined) ? `${p.voltage.min ?? ""}..${p.voltage.max ?? ""} V` : `${p.voltage.nominal} V`}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted">No pins yet. Choose a kind or a library entry, or add pins.</p>
          )
        ) : (
          <div className="mt-3 space-y-2">
            <div className="max-h-[42vh] overflow-auto rounded-md border border-hairline">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-subtle text-left text-[10px] uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="px-2 py-1.5">Name</th>
                    <th className="px-2 py-1.5">Kind</th>
                    <th className="px-2 py-1.5">Side</th>
                    <th className="px-2 py-1.5">Min V</th>
                    <th className="px-2 py-1.5">Max V</th>
                    <th className="px-2 py-1.5">Gives V</th>
                    <th className="px-2 py-1.5">Max mA</th>
                    <th className="px-2 py-1.5">Bus</th>
                    <th className="px-2 py-1.5">Optional</th>
                    <th className="px-2 py-1.5">Pull-up</th>
                    <th className="px-2 py-1.5">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d, i) => (
                    <tr key={i} className="border-t border-hairline">
                      <td className="px-1 py-1">
                        <Input value={d.name} onChange={(e) => set(i, { name: e.target.value })} aria-label={`Name of pin ${i + 1}`} className="h-7 w-24 font-mono text-xs" />
                      </td>
                      <td className="px-1 py-1">
                        <NativeSelect value={d.kind} onChange={(e) => set(i, { kind: e.target.value as PinKind | "" })} aria-label={`Kind of pin ${i + 1}`} className="h-7 w-36 pr-6 text-xs">
                          <option value="">Not stated</option>
                          {PIN_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {PIN_KIND_LABEL[k]}
                            </option>
                          ))}
                        </NativeSelect>
                      </td>
                      <td className="px-1 py-1">
                        <NativeSelect value={d.side} onChange={(e) => set(i, { side: e.target.value as Side | "" })} aria-label={`Symbol side of pin ${i + 1}`} className="h-7 w-28 pr-6 text-xs">
                          <option value="">From kind</option>
                          {SIDES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </NativeSelect>
                      </td>
                      {(["vmin", "vmax", "vnom", "imax"] as const).map((k) => (
                        <td key={k} className="px-1 py-1">
                          <Input value={d[k]} onChange={(e) => set(i, { [k]: e.target.value })} inputMode="decimal" aria-label={`${{ vmin: "Lowest voltage", vmax: "Highest voltage", vnom: "Voltage given", imax: "Most current" }[k]} of pin ${i + 1}`} className="h-7 w-16 font-mono text-xs" />
                        </td>
                      ))}
                      <td className="px-1 py-1">
                        <NativeSelect value={d.bus} onChange={(e) => set(i, { bus: e.target.value })} aria-label={`Bus of pin ${i + 1}`} className="h-7 w-28 text-xs">
                          <option value="">None</option>
                          {BUS_OPTIONS.map((b) => (
                            <option key={b.value} value={b.value}>
                              {b.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input type="checkbox" checked={d.optional} onChange={(e) => set(i, { optional: e.target.checked })} aria-label={`Pin ${i + 1} may be left unconnected`} />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input type="checkbox" checked={d.pullUp} onChange={(e) => set(i, { pullUp: e.target.checked })} aria-label={`Pin ${i + 1} has its own pull-up`} />
                      </td>
                      <td className="px-1 py-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove pin ${d.name || i + 1}`} onClick={() => setDrafts((ds) => (ds ?? []).filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted">Min V and Max V: what a pin that takes power accepts. Gives V: what a pin that supplies power gives. Max mA: most a supply gives, or most a part draws. Leave a figure empty unless a datasheet states it.</p>
            <div className="flex flex-wrap justify-between gap-2">
              <Button size="sm" variant="outline" onClick={() => setDrafts((ds) => [...(ds ?? []), toDraft({ name: "", kind: null })])}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add pin
              </Button>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setDrafts(resolved.source === "own" ? resolved.pins.map((p) => toDraft(pinToDef(p))) : null)}>
                  Cancel changes
                </Button>
                <Button size="sm" onClick={savePins} disabled={busy}>
                  {busy ? "Saving pins" : "Save pins"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
      <div className="flex justify-end border-t border-hairline pt-3">
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
