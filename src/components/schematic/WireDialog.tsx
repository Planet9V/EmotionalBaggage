"use client";

import { useId, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NetClass, Wire } from "@/lib/domain";
import { CLASSES, CLASS_LABEL, WIRE_STATUSES, type NetInfo, type Part } from "./model";
import { ErrorLine, Field, Modal, Select, Textarea } from "./controls";

export type WireDraft = {
  name: string;
  net: string;
  netClass: NetClass;
  note: string;
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
  via: string;
  order: number;
  status: string;
};

export type WireDialogMode =
  | { kind: "new"; from: string; fromPin: string; to: string; toPin: string }
  | { kind: "edit"; wire: Wire };

type Props = {
  mode: WireDialogMode;
  parts: Part[];
  nets: NetInfo[];
  /** pins known per ref, for the pin suggestions */
  pinsByRef: Map<string, string[]>;
  nextOrder: number;
  statuses: string[];
  onClose: () => void;
  onSave: (draft: WireDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export const autoName = (d: Pick<WireDraft, "from" | "fromPin" | "to" | "toPin">) => `${d.from}.${d.fromPin || "?"} to ${d.to}.${d.toPin || "?"}`;

/** Create or edit one wire. Opened by dragging pin to pin, or from a selected wire. */
export function WireDialog({ mode, parts, nets, pinsByRef, nextOrder, statuses, onClose, onSave, onDelete }: Props) {
  const uid = useId();
  const editing = mode.kind === "edit";
  const [d, setD] = useState<WireDraft>(() =>
    mode.kind === "edit"
      ? {
          name: mode.wire.name,
          net: mode.wire.net,
          netClass: mode.wire.netClass,
          note: mode.wire.note,
          from: mode.wire.from,
          fromPin: mode.wire.fromPin,
          to: mode.wire.to,
          toPin: mode.wire.toPin,
          via: mode.wire.via,
          order: mode.wire.order,
          status: mode.wire.status,
        }
      : { name: "", net: "", netClass: "signal", note: "", from: mode.from, fromPin: mode.fromPin, to: mode.to, toPin: mode.toPin, via: "", order: nextOrder, status: "to solder" }
  );
  const [classTouched, setClassTouched] = useState(editing);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refs = useMemo(() => {
    const list = parts.map((p) => p.ref);
    for (const r of [d.from, d.to]) if (r && !list.includes(r)) list.push(r);
    return list;
  }, [parts, d.from, d.to]);
  const netClassOf = useMemo(() => new Map(nets.map((n) => [n.name, n.classes[0]])), [nets]);
  const statusList = d.status && !statuses.includes(d.status) ? [...statuses, d.status] : statuses.length ? statuses : WIRE_STATUSES;

  const set = <K extends keyof WireDraft>(k: K, v: WireDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setNet = (net: string) => {
    setD((x) => {
      const known = netClassOf.get(net.trim());
      return { ...x, net, netClass: !classTouched && known ? known : x.netClass };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.from || !d.to) return setError("Pick a part at both ends.");
    if (!d.fromPin.trim() || !d.toPin.trim()) return setError("Name the pin at both ends.");
    if (d.from === d.to && d.fromPin.trim() === d.toPin.trim()) return setError("A wire needs two different pins.");
    if (!Number.isFinite(d.order)) return setError("Order must be a number.");
    setBusy(true);
    setError("");
    try {
      await onSave({ ...d, fromPin: d.fromPin.trim(), toPin: d.toPin.trim(), net: d.net.trim(), name: d.name.trim() || autoName({ ...d, fromPin: d.fromPin.trim(), toPin: d.toPin.trim() }) });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    setBusy(true);
    setError("");
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const pinList = (ref: string, listId: string) => (
    <datalist id={listId}>
      {(pinsByRef.get(ref) ?? []).map((p) => (
        <option key={p} value={p} />
      ))}
    </datalist>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Wire ${mode.wire.order}` : "New wire"}
      description={editing ? "Change any field, or delete the wire." : "Saved to the wiring list with status to solder."}
      width="560px"
    >
      {confirming ? (
        <div className="space-y-4">
          <p className="text-sm text-primary">
            Delete wire {d.order} ({d.name || autoName(d)})? It is removed from the wiring list and the build sheet. This cannot be undone.
          </p>
          {error && <ErrorLine>{error}</ErrorLine>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
            <Button onClick={remove} disabled={busy} className="bg-danger-solid! hover:opacity-90!">
              <Trash2 className="h-4 w-4" aria-hidden /> Delete wire
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <Field label="From part">
              <Select value={d.from} onChange={(e) => set("from", e.target.value)}>
                {refs.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="From pin">
              <Input value={d.fromPin} onChange={(e) => set("fromPin", e.target.value)} list={`${uid}-fp`} className="font-mono" />
              {pinList(d.from, `${uid}-fp`)}
            </Field>
            <Field label="To part">
              <Select value={d.to} onChange={(e) => set("to", e.target.value)}>
                {refs.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To pin">
              <Input value={d.toPin} onChange={(e) => set("toPin", e.target.value)} list={`${uid}-tp`} className="font-mono" />
              {pinList(d.to, `${uid}-tp`)}
            </Field>
          </div>
          <Field label="Name">
            <Input value={d.name} onChange={(e) => set("name", e.target.value)} placeholder={autoName(d)} autoFocus={!editing} />
          </Field>
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <Field label="Net" hint="Pick an existing net or type a new one.">
              <Input value={d.net} onChange={(e) => setNet(e.target.value)} list={`${uid}-nets`} className="font-mono" placeholder="GND" />
              <datalist id={`${uid}-nets`}>
                {nets.map((n) => (
                  <option key={n.name} value={n.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Net class">
              <Select
                value={d.netClass}
                onChange={(e) => {
                  setClassTouched(true);
                  set("netClass", e.target.value as NetClass);
                }}
              >
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-[88px_1fr] gap-3">
              <Field label="Order">
                <Input type="number" value={Number.isFinite(d.order) ? d.order : ""} onChange={(e) => set("order", e.target.value === "" ? NaN : Number(e.target.value))} className="font-mono" />
              </Field>
              {editing ? (
                <Field label="Status">
                  <Select value={d.status} onChange={(e) => set("status", e.target.value)}>
                    {statusList.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label="Status">
                  <p className="flex h-9 items-center text-sm text-secondary">to solder</p>
                </Field>
              )}
            </div>
          </div>
          <Field label="Note" hint="A check to make, a value, a warning. Shown on the build sheet.">
            <Textarea rows={2} value={d.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
          {error && <ErrorLine>{error}</ErrorLine>}
          <div className="flex items-center justify-between gap-2 pt-1">
            {editing && onDelete ? (
              <Button type="button" variant="ghost" onClick={() => setConfirming(true)} className="text-danger hover:text-danger">
                <Trash2 className="h-4 w-4" aria-hidden /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving" : editing ? "Save wire" : "Add wire"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
