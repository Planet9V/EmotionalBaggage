"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NetClass } from "@/lib/domain";
import { CLASSES, CLASS_LABEL, type Part } from "./model";
import { ErrorLine, Field, Select } from "./controls";
import { autoName, type WireDraft } from "./WireDialog";

/** The first wire, typed in: two parts, two pin names, a net. Works before anything is on the canvas. */
export function FirstConnection({ parts, nextOrder, onSave, onDone }: { parts: Part[]; nextOrder: number; onSave: (d: WireDraft) => Promise<void>; onDone?: () => void }) {
  const [from, setFrom] = useState(parts[0]?.ref ?? "");
  const [to, setTo] = useState(parts[1]?.ref ?? parts[0]?.ref ?? "");
  const [fromPin, setFromPin] = useState("");
  const [toPin, setToPin] = useState("");
  const [net, setNet] = useState("");
  const [netClass, setNetClass] = useState<NetClass>("signal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fp = fromPin.trim();
    const tp = toPin.trim();
    if (!from || !to) return setError("Pick a part at both ends.");
    if (!fp || !tp) return setError("Type the pin name at both ends.");
    if (from === to && fp === tp) return setError("A wire needs two different pins.");
    setBusy(true);
    setError("");
    try {
      await onSave({ name: autoName({ from, fromPin: fp, to, toPin: tp }), net: net.trim(), netClass, note: "", from, fromPin: fp, to, toPin: tp, via: "", order: nextOrder, status: "to solder" });
      setFromPin("");
      setToPin("");
      setNet("");
      setBusy(false);
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const partSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {parts.map((p) => (
        <option key={p.item.id} value={p.ref}>
          {p.ref} · {p.title}
        </option>
      ))}
    </Select>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="From part">{partSelect(from, setFrom)}</Field>
        <Field label="From pin">
          <Input value={fromPin} onChange={(e) => setFromPin(e.target.value)} className="font-mono" placeholder="GND" />
        </Field>
        <Field label="To part">{partSelect(to, setTo)}</Field>
        <Field label="To pin">
          <Input value={toPin} onChange={(e) => setToPin(e.target.value)} className="font-mono" placeholder="GND" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="Net">
          <Input value={net} onChange={(e) => setNet(e.target.value)} className="font-mono" placeholder="GND" />
        </Field>
        <Field label="Net class">
          <Select value={netClass} onChange={(e) => setNetClass(e.target.value as NetClass)}>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {CLASS_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
      <Button type="submit" disabled={busy || !parts.length}>
        <Plus className="h-4 w-4" aria-hidden /> {busy ? "Adding" : "Add first connection"}
      </Button>
    </form>
  );
}
