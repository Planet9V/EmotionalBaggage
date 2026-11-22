"use client";

// Admin, Payments: the Stripe keys (the shared key card, provider "stripe"), the mode the keys are in, and the
// webhook address to paste into Stripe. No billing happens here: the billing code reads getStripeSettings().
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { LoadError, LoadingBlocks } from "@/components/ui/states";
import { messageOf } from "@/lib/queries";
import { usePayments } from "@/lib/admin/client";
import { CredentialsTab } from "./CredentialsTab";

export function PaymentsTab() {
  const pay = usePayments();
  if (pay.isPending) return <LoadingBlocks rows={2} label="Reading the payment settings" />;
  if (pay.isError) return <LoadError what="The payment settings" message={messageOf(pay.error)} onRetry={() => void pay.refetch()} />;
  const p = pay.data;
  // read after the data arrives, so only in the browser (the server renders the loading state)
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const webhook = `${origin}${p.webhookPath}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(webhook);
      toast.success("The webhook address is copied.");
    } catch {
      toast.error("Copying is not allowed here. Select the address and copy it by hand.");
    }
  };
  return (
    <div className="space-y-4">
      <Panel
        title="Payments"
        description="Stripe takes the payments; no card details ever reach this app. Until the keys are saved, nothing can be bought and the public page asks for access instead."
        actions={
          p.configured ? (
            <StatusBadge tone={p.mode === "live" ? "warning" : "info"} data-testid="stripe-mode">{p.mode === "live" ? "Live mode: real payments" : "Test mode: no real money"}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral" data-testid="stripe-mode">Not configured</StatusBadge>
          )
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary" role="status">
            {p.configured
              ? `The keys are ${p.mode} keys (read from their prefix).${p.webhookSecret ? " A webhook signing secret is saved." : " No webhook signing secret is saved yet, so Stripe's events cannot be checked; add it once the webhook exists."}`
              : p.reason}
          </p>
          <Field id="stripe-webhook" label="Webhook address" hint="In the Stripe Dashboard, Developers, Webhooks: add an endpoint with this address, then paste its signing secret below.">
            <div className="flex flex-wrap gap-2">
              <Input id="stripe-webhook" readOnly value={webhook} className="min-w-0 flex-1 font-mono text-xs" aria-describedby="stripe-webhook-hint" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
                <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
              </Button>
            </div>
          </Field>
          <p className="text-xs text-muted">The billing workstream answers at this address; until it is built, Stripe&apos;s test events to it are refused.</p>
        </div>
      </Panel>
      <CredentialsTab only={["stripe"]} intro={false} />
    </div>
  );
}
