"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorLine, Field, Modal } from "./controls";

/** Name one pin: used for "Add pin" on a node and for the first pin of a part placed from the palette. */
export function PinDialog({
  title,
  description,
  existing,
  submitLabel,
  onClose,
  onSave,
}: {
  title: string;
  description: string;
  existing: string[];
  submitLabel: string;
  onClose: () => void;
  onSave: (pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = pin.trim();
    if (!name) return setError("Type a pin name, as printed on the board or in the datasheet.");
    if (existing.includes(name)) return setError(`This part already has a pin called ${name}.`);
    setBusy(true);
    setError("");
    try {
      await onSave(name);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title} description={description} width="420px">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Pin name" hint={existing.length ? `Pins so far: ${existing.join(", ")}` : undefined}>
          <Input value={pin} onChange={(e) => setPin(e.target.value)} autoFocus className="font-mono" placeholder="GPIO5" />
        </Field>
        {error && <ErrorLine>{error}</ErrorLine>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving" : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
