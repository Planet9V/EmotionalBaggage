"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorLine } from "@/components/parts/controls";
import { Modal } from "@/components/parts/Modal";
import { num, type PartInput } from "@/lib/economics/read";

type Row = { qty: string; unit: string };

export function PriceBreaksDialog({
  part,
  currency,
  onClose,
  onSave,
}: {
  part: PartInput | null;
  currency: string;
  onClose: () => void;
  onSave: (id: number, breaks: { qty: number; unit: number }[]) => Promise<void>;
}) {
  return (
    <Modal
      open={part !== null}
      onOpenChange={(o) => !o && onClose()}
      title={part ? `Price breaks for ${part.ref ? `${part.ref} ` : ""}${part.title}` : "Price breaks"}
      description={`The price of one piece in ${currency} once the order reaches a quantity. The order is the quantity per unit times the batch size.`}
    >
      {part ? <Form key={part.id} part={part} onClose={onClose} onSave={onSave} /> : null}
    </Modal>
  );
}

function Form({ part, onClose, onSave }: { part: PartInput; onClose: () => void; onSave: (id: number, breaks: { qty: number; unit: number }[]) => Promise<void> }) {
  const [rows, setRows] = useState<Row[]>(part.breaks.length ? part.breaks.map((b) => ({ qty: String(b.qty), unit: String(b.unit) })) : [{ qty: "", unit: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const out: { qty: number; unit: number }[] = [];
    for (const [i, r] of rows.entries()) {
      if (r.qty.trim() === "" && r.unit.trim() === "") continue;
      const qty = num(r.qty);
      const unit = num(r.unit);
      if (qty === null || !Number.isInteger(qty) || qty < 1) return setError(`Row ${i + 1}: the quantity must be a whole number of at least 1.`);
      if (unit === null || unit < 0) return setError(`Row ${i + 1}: enter the price of one piece, zero or more.`);
      out.push({ qty, unit });
    }
    if (new Set(out.map((b) => b.qty)).size !== out.length) return setError("Two rows have the same quantity.");
    setBusy(true);
    setError("");
    try {
      await onSave(part.id, out.sort((a, b) => a.qty - b.qty));
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-secondary">From quantity</span>
              <Input inputMode="numeric" value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} aria-label={`Row ${i + 1} from quantity`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-secondary">Price of one piece</span>
              <Input inputMode="decimal" value={r.unit} onChange={(e) => set(i, { unit: e.target.value })} aria-label={`Row ${i + 1} price of one piece`} />
            </label>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove row ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { qty: "", unit: "" }])}>
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add a break
      </Button>
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving" : "Save"}
        </Button>
      </div>
    </form>
  );
}
