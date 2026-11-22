"use client";

// The toast that follows a card dropped on another status. A small popover after a drop would be too heavy, so
// the reason is offered here: "Add a reason" opens one short field inside the toast and saves it against the
// signed-in person's latest change to the row (POST /api/items/[id]/reason).
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/http";
import { messageOf } from "@/lib/queries";
import { describe } from "@/components/ui/field";

const schema = z.object({ why: z.string().trim().min(1, "Type the reason.") });
type Values = z.infer<typeof schema>;

function MovedToast({ id, itemId, title, status, toastId }: { id: string; itemId: number; title: string; status: string; toastId: string | number }) {
  const [asking, setAsking] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting: busy } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { why: "" } });
  const error = errors.why?.message ?? errors.root?.message ?? "";
  const save = handleSubmit(async ({ why }) => {
    try {
      await api(`/api/items/${itemId}/reason`, { method: "POST", body: JSON.stringify({ why }) });
      toast.dismiss(toastId);
      toast.success("Reason saved in the history.");
    } catch (err) {
      setError("root", { message: messageOf(err) || "The reason was not saved." });
    }
  });
  return (
    <div role="status" className="w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-hairline bg-surface p-3 text-sm text-primary shadow-lg" data-testid="moved-toast">
      <p className="wrap-anywhere">
        Moved <span className="font-medium">{title}</span> to {status}.
      </p>
      {asking ? (
        <form onSubmit={(e) => void save(e)} className="mt-2 flex items-end gap-2" noValidate>
          <div className="min-w-0 flex-1">
            <label htmlFor={id} className="mb-1 block text-xs font-medium text-secondary">
              Why (kept in the history)
            </label>
            <Input id={id} maxLength={1000} autoComplete="off" autoFocus {...describe(id, { error })} {...register("why")} />
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
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger wrap-anywhere">
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
