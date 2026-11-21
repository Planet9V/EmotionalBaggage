"use client";

// The toast that follows a card dropped on another status. A small popover after a drop would be too heavy, so
// the reason is offered here: "Add a reason" opens one short field inside the toast and saves it against the
// signed-in person's latest change to the row (POST /api/items/[id]/reason).
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/http";
import { messageOf } from "@/lib/queries";

function MovedToast({ id, itemId, title, status, toastId }: { id: string; itemId: number; title: string; status: string; toastId: string | number }) {
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!why.trim()) {
      setError("Type the reason.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/items/${itemId}/reason`, { method: "POST", body: JSON.stringify({ why: why.trim() }) });
      toast.dismiss(toastId);
      toast.success("Reason saved in the history.");
    } catch (err) {
      setError(messageOf(err) || "The reason was not saved.");
      setBusy(false);
    }
  };
  return (
    <div role="status" className="w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-hairline bg-surface p-3 text-sm text-primary shadow-lg" data-testid="moved-toast">
      <p className="wrap-anywhere">
        Moved <span className="font-medium">{title}</span> to {status}.
      </p>
      {asking ? (
        <form onSubmit={save} className="mt-2 flex items-end gap-2" noValidate>
          <div className="min-w-0 flex-1">
            <label htmlFor={id} className="mb-1 block text-xs font-medium text-secondary">
              Why (kept in the history)
            </label>
            <Input id={id} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={1000} autoComplete="off" autoFocus />
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving" : "Save"}
          </Button>
        </form>
      ) : (
        <div className="mt-1 flex gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={() => setAsking(true)}>
            Add a reason
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => toast.dismiss(toastId)}>
            Dismiss
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger wrap-anywhere">
          {error}
        </p>
      )}
    </div>
  );
}

/** Says a card moved, with a way to say why. Long enough to read and to type a short reason. */
export function announceMove(item: { id: number; title: string }, status: string) {
  toast.custom((toastId) => <MovedToast id={`moved-why-${item.id}`} itemId={item.id} title={item.title} status={status} toastId={toastId} />, { duration: 20000 });
}
