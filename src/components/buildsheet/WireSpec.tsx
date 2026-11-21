"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AMPACITY_SOURCE, CONNECTIONS, connectionOf, stripSummary, swatch, totalsByColour, type SpecRow } from "./wiresheet";
import type { PartLite } from "./derive";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/Card";

type Props = {
  rows: SpecRow[];
  parts: Map<string, PartLite>;
  /** refs of the parts any wire touches, in order */
  refs: string[];
  strips: Record<string, number>;
  onStrip: (key: string, mm: number) => void;
  onPartData: (itemId: number, data: Record<string, unknown>) => Promise<void> | void;
  onWireData: (itemId: number, data: Record<string, unknown>) => Promise<void> | void;
};

/** A number field that saves when it loses focus or on Enter. Blank clears; anything else that is not a positive number is refused. */
function Num({ label, value, onSave, width = "w-24" }: { label: string; value: number | null; onSave: (n: number | null) => Promise<void> | void; width?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const shown = draft ?? (value === null ? "" : String(value));
  const commit = async () => {
    if (draft === null) return;
    const t = draft.trim();
    const n = t === "" ? null : Number(t);
    if (n !== null && (!Number.isFinite(n) || n <= 0)) return setErr("Enter a number above zero, or leave it blank.");
    setErr("");
    setDraft(null);
    if (n === value) return;
    try {
      await onSave(n);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <span className="inline-flex flex-col">
      <Input
        aria-label={label}
        inputMode="decimal"
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commit(); } }}
        aria-invalid={err ? true : undefined}
        className={`h-8 ${width} font-mono text-xs`}
      />
      {err ? <span role="alert" className="mt-0.5 text-[11px] text-danger">{err}</span> : null}
    </span>
  );
}

export function WireSpec({ rows, parts, refs, strips, onStrip, onPartData, onWireData }: Props) {
  const totals = totalsByColour(rows);
  const strip = stripSummary(rows, parts, strips);
  const unknownGauge = rows.filter((r) => r.gauge.set === "none" && r.gauge.label === "not set").length;
  return (
    <div className="space-y-4">
      <Card variant="well" className="no-print space-y-2 p-3">
        <p className="text-sm font-medium text-primary">What each part draws and how it connects</p>
        <p className="text-xs text-secondary">
          A wire&apos;s gauge comes from its current. Enter the current a part draws (peak, in mA) and the connection type used at it. A wire takes the larger figure of its two ends; type a current on a single wire below to override. Where no current is set, the gauge stays unset.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted"><th className="py-1 pr-3 font-medium">Part</th><th className="py-1 pr-3 font-medium">Draws (mA)</th><th className="py-1 font-medium">Connection at this part</th></tr>
            </thead>
            <tbody>
              {refs.map((ref) => {
                const p = parts.get(ref);
                return (
                  <tr key={ref} className="border-t border-hairline">
                    <td className="py-1.5 pr-3"><span className="font-mono text-primary">{ref}</span> <span className="text-secondary">{p ? p.title : "not in the bill of materials"}</span></td>
                    <td className="py-1.5 pr-3">
                      {p ? <Num label={`Current drawn by ${ref} in mA`} value={Number(p.item.data.currentMa) > 0 ? Number(p.item.data.currentMa) : null} onSave={(n) => onPartData(p.item.id, { currentMa: n })} /> : <span className="text-muted">n/a</span>}
                    </td>
                    <td className="py-1.5">
                      {p ? (
                        <NativeSelect aria-label={`Connection type at ${ref}`} className="h-8 text-xs" value={connectionOf(p)} onChange={(e) => void onPartData(p.item.id, { connection: e.target.value || null })}>
                          <option value="">Not set</option>
                          {CONNECTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </NativeSelect>
                      ) : <span className="text-muted">n/a</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-secondary">
        Gauge is the thinnest AWG whose chassis-wiring current limit carries the wire&apos;s current, from the table at{" "}
        <a href={AMPACITY_SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-link underline-offset-2 hover:underline">{AMPACITY_SOURCE.label}</a>
        . Those limits are for single wires in free air; a tight bundle or a warm enclosure needs a thicker wire. {unknownGauge ? `${unknownGauge} of ${rows.length} wires have no current set, so no gauge is given for them.` : ""}
      </p>

      <Card variant="flat" className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Colour</TableHead>
              <TableHead>Gauge</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Cut length</TableHead>
              <TableHead className="text-right">Strip from / to</TableHead>
              <TableHead className="no-print text-right">Override</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.wire.item.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    {swatch(r.colour) && <span className="bs-dot inline-block h-3 w-3 rounded-full border border-hairline" style={{ backgroundColor: swatch(r.colour) }} aria-hidden />}
                    {r.colour}
                    {!r.colourSet && <span className="text-muted">suggested</span>}
                  </span>
                </TableCell>
                <TableCell className="font-mono" title={r.gauge.why}>
                  <span className={r.gauge.set === "none" ? "text-muted" : "text-primary"}>{r.gauge.label}</span>
                  {r.gauge.set === "user" && <span className="text-muted"> set</span>}
                </TableCell>
                <TableCell className="font-mono">{String(r.step).padStart(2, "0")}</TableCell>
                <TableCell className="font-mono text-primary">{r.wire.from}.{r.wire.fromPin}</TableCell>
                <TableCell className="font-mono text-primary">{r.wire.to}.{r.wire.toPin}</TableCell>
                <TableCell className="text-right font-mono">
                  {r.current.mA === null ? <span className="text-muted">not set</span> : <span title={r.current.basis === "part" ? `from ${r.current.from}` : "set on this wire"}>{r.current.mA} mA</span>}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {r.length ? <span className="text-primary">{r.length.mm} mm <span className="text-muted">{r.length.source}</span></span> : <span className="text-muted">no length</span>}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {r.stripFrom === null ? <span className="text-muted">?</span> : `${r.stripFrom}`} / {r.stripTo === null ? <span className="text-muted">?</span> : `${r.stripTo}`} mm
                </TableCell>
                <TableCell className="no-print text-right">
                  <span className="inline-flex gap-1">
                    <Num label={`Current of wire ${r.wire.name} in mA`} value={Number((r.wire.item.data as Record<string, unknown>).currentMa) > 0 ? Number((r.wire.item.data as Record<string, unknown>).currentMa) : null} onSave={(n) => onWireData(r.wire.item.id, { currentMa: n })} width="w-20" />
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div>
        <p className="mb-1 text-sm font-medium text-primary">Total wire to cut</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-secondary" aria-label="Total wire per colour and gauge">
          {totals.map((t) => (
            <li key={`${t.colour}-${t.gauge}`} className="inline-flex items-center gap-1.5 font-mono">
              {swatch(t.colour) && <span className="bs-dot inline-block h-3 w-3 rounded-full border border-hairline" style={{ backgroundColor: swatch(t.colour) }} aria-hidden />}
              {t.colour}, {t.gauge}: <span className="text-primary">{t.mm} mm</span>
              <span className="text-muted">({t.wires} {t.wires === 1 ? "wire" : "wires"}{t.withLength < t.wires ? `, ${t.wires - t.withLength} with no length` : ""}{t.routed ? `, ${t.routed} routed` : ""})</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">Strip lengths and connector details</p>
        <p className="text-xs text-secondary">
          These are starting values from general bench practice, not from a connector data sheet. Change a value to match the terminal&apos;s data sheet; the change applies on this screen and in the table above. Crimp the stripped wire only with the tool and terminal the maker names.
        </p>
        {strip.used.length ? (
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {strip.used.map((u) => (
              <li key={u.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-primary">{u.label} <span className="text-muted">{u.ends} wire {u.ends === 1 ? "end" : "ends"}</span></span>
                <span className="inline-flex items-center gap-1 text-secondary"><Num label={`Strip length for ${u.label} in mm`} value={u.strip} onSave={(n) => { if (n) onStrip(u.key, n); }} width="w-16" /> mm</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No connection type is set on any part yet.</p>
        )}
        {strip.unset.length > 0 && <p className="text-xs text-muted">No connection type set at: {strip.unset.join(", ")}.</p>}
      </div>
    </div>
  );
}
