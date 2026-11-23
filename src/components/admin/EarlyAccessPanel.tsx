"use client";

// Admin, Pricing and tiers: the number of early-access places (the setting earlyAccess.limit, default 50) and where
// they stand. A place is held by a request with a place number that is not declined; the rest wait in order.
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, describe } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import {
  LoadError,
  LoadingBlocks,
  SavedNote,
  useFlag,
} from "@/components/ui/states";
import { messageOf } from "@/lib/queries";
import { useAdminAccess } from "@/lib/admin/client";
import {
  useEarlyAccessCount,
  useSaveEarlyAccessLimit,
} from "@/lib/admin/earlyAccessClient";
import type { EarlyAccessCount } from "@/lib/accessRequests/shared";

export function EarlyAccessPanel() {
  const count = useEarlyAccessCount();
  return (
    <Panel
      title="Early access"
      description="How many early-access places the public page offers. A place is held by every request with a place number that is not declined; after that, requests go on the waiting list in order. Declining a request, or raising the number, gives the freed places to the waiting list at once."
    >
      {count.isPending ? (
        <LoadingBlocks rows={1} label="Reading the early-access places" />
      ) : count.isError ? (
        <LoadError
          what="The early-access places"
          message={messageOf(count.error)}
          onRetry={() => void count.refetch()}
        />
      ) : (
        <LimitForm count={count.data} />
      )}
    </Panel>
  );
}

function LimitForm({ count }: { count: EarlyAccessCount }) {
  const save = useSaveEarlyAccessLimit();
  const canWrite = useAdminAccess().capabilities.plans;
  const [text, setText] = useState(String(count.limit));
  const [error, setError] = useState("");
  const [saved, markSaved] = useFlag();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const n = Number(text.trim());
    if (!/^\d+$/.test(text.trim()) || n > 100_000) {
      setError("Enter a whole number from 0 to 100,000.");
      return;
    }
    try {
      await save.mutateAsync(n);
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setError(m);
      toast.error(m);
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="space-y-3"
      aria-label="Early-access places"
    >
      <p
        className="text-sm text-secondary"
        role="status"
        data-testid="early-access-count"
      >
        {count.held} of {count.limit} places held, {count.left} left,{" "}
        {count.waiting} on the waiting list.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field
          id="early-limit"
          label="Places"
          error={error || undefined}
          hint="Default 50. Lowering it takes no place back."
        >
          <Input
            id="early-limit"
            inputMode="numeric"
            className="w-32"
            value={text}
            onChange={(e) => setText(e.target.value)}
            {...describe("early-limit", {
              hint: true,
              error: error || undefined,
            })}
          />
        </Field>
        <Button
          type="submit"
          size="sm"
          disabled={save.isPending || !canWrite}
          className="mb-5"
        >
          {save.isPending ? "Saving…" : "Save places"}
        </Button>
        <SavedNote show={saved} />
      </div>
    </form>
  );
}
