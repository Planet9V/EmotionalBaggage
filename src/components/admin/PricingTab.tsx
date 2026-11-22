"use client";

// Admin, Pricing and tiers: the plan catalogue as data. Each tier's name, prices, limits and Stripe price ids, and
// one switch for showing prices on the public page. The public welcome page reads what is saved here (no deploy).
// The form is react-hook-form over text fields; on Save the text is read into numbers and checked with the same
// schema the server uses (src/lib/admin/planSchema.ts), and each problem is shown at its field.
import { useEffect } from "react";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { ArrowDown, ArrowUp, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, describe } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { LoadError, LoadingBlocks, SaveError, SavedNote, useFlag } from "@/components/ui/states";
import { messageOf } from "@/lib/queries";
import { moneyOrNull, readMoney } from "@/lib/moneyText";
import { LIMIT_KEYS, LIMIT_LABEL, planCatalogue, type LimitKey, type PlanCatalogue, type PlanTier } from "@/lib/admin/planSchema";
import { useAdminAccess, usePlans, useResetPlans, useSavePlans } from "@/lib/admin/client";

type TierForm = {
  key: string;
  name: string;
  shown: boolean;
  paid: boolean;
  currency: string;
  priceMonthly: string;
  priceYearly: string;
  who: string;
  what: string;
  includes: string;
  action: "request" | "run";
  limits: Record<LimitKey, string>;
  stripePriceMonthly: string;
  stripePriceYearly: string;
};
type Form = { showPrices: boolean; tiers: TierForm[] };

const text = (n: number | null) => (n === null ? "" : String(n));
const toForm = (c: PlanCatalogue): Form => ({
  showPrices: c.showPrices,
  tiers: c.tiers.map((t) => ({
    ...t,
    priceMonthly: text(t.priceMonthly),
    priceYearly: text(t.priceYearly),
    includes: t.includes.join("\n"),
    limits: Object.fromEntries(LIMIT_KEYS.map((k) => [k, text(t.limits[k])])) as Record<LimitKey, string>,
    stripePriceMonthly: t.stripePriceMonthly ?? "",
    stripePriceYearly: t.stripePriceYearly ?? "",
  })),
});

/** A whole number, null when blank, NaN when it is not one (the schema then names the field). */
const count = (s: string): number | null => (s.trim() === "" ? null : /^\d+$/.test(s.trim()) ? Number(s.trim()) : Number.NaN);
const money = (s: string): number | null => (s.trim() === "" ? null : (moneyOrNull(s) ?? readMoney(s) ?? Number.NaN));

const fromForm = (f: Form): unknown => ({
  showPrices: f.showPrices,
  tiers: f.tiers.map(
    (t): Record<keyof PlanTier, unknown> => ({
      key: t.key.trim(),
      name: t.name,
      shown: t.shown,
      paid: t.paid,
      currency: t.currency.trim().toUpperCase(),
      priceMonthly: money(t.priceMonthly),
      priceYearly: money(t.priceYearly),
      who: t.who,
      what: t.what,
      includes: t.includes.split("\n").map((l) => l.trim()).filter(Boolean),
      action: t.action,
      limits: Object.fromEntries(LIMIT_KEYS.map((k) => [k, count(t.limits[k])])),
      stripePriceMonthly: t.stripePriceMonthly.trim() || null,
      stripePriceYearly: t.stripePriceYearly.trim() || null,
    })
  ),
});

const BLANK: TierForm = {
  key: "",
  name: "",
  shown: false,
  paid: true,
  currency: "USD",
  priceMonthly: "",
  priceYearly: "",
  who: "",
  what: "",
  includes: "",
  action: "request",
  limits: Object.fromEntries(LIMIT_KEYS.map((k) => [k, ""])) as Record<LimitKey, string>,
  stripePriceMonthly: "",
  stripePriceYearly: "",
};

export function PricingTab() {
  const plans = usePlans();
  if (plans.isPending) return <LoadingBlocks rows={3} label="Reading the plan catalogue" />;
  if (plans.isError) return <LoadError what="The plan catalogue" message={messageOf(plans.error)} onRetry={() => void plans.refetch()} />;
  return <Editor initial={plans.data.catalogue} source={plans.data.source} problem={plans.data.problem} />;
}

function Editor({ initial, source, problem }: { initial: PlanCatalogue; source: "database" | "built-in"; problem?: string }) {
  const save = useSavePlans();
  const reset = useResetPlans();
  const canWrite = useAdminAccess().capabilities.plans;
  const [saved, markSaved] = useFlag();
  const form = useForm<Form>({ defaultValues: toForm(initial) });
  const { register, control, handleSubmit, setError, clearErrors, formState, setValue } = form;
  const values = useWatch({ control });
  const tiers = useFieldArray({ control, name: "tiers" });
  useEffect(() => form.reset(toForm(initial)), [initial, form]);

  const submit = handleSubmit(async (values) => {
    clearErrors();
    const r = planCatalogue.safeParse(fromForm(values));
    if (!r.success) {
      for (const i of r.error.issues) {
        const path = i.path.join(".") as FieldPath<Form>;
        const isField = i.path.length >= 3;
        setError(isField ? path : "root", { message: isField ? i.message : `Tiers ${i.message}.` });
      }
      return;
    }
    try {
      await save.mutateAsync(r.data);
      markSaved();
    } catch (e) {
      const m = messageOf(e);
      setError("root", { message: m });
      toast.error(m);
    }
  });

  const showPrices = !!values.showPrices;

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Plan catalogue" aria-busy={save.isPending || undefined}>
      <Panel
        title="Pricing and tiers"
        description="The service levels on the public page, their prices and limits, and the Stripe prices billing will use. Saved here, the public page changes at once. Limits left blank are not set; nothing enforces limits yet."
        actions={<StatusBadge tone={source === "database" ? "success" : "neutral"}>{source === "database" ? "Saved in Admin" : "Built-in catalogue"}</StatusBadge>}
      >
        <div className="space-y-3">
          {problem ? <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">{problem}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Switch id="show-prices" checked={showPrices} onCheckedChange={(v) => setValue("showPrices", v, { shouldDirty: true })} aria-describedby="show-prices-hint" />
            <label htmlFor="show-prices" className="text-sm font-medium text-primary">Show prices on the public page</label>
          </div>
          <p id="show-prices-hint" className="text-xs text-muted">
            {showPrices ? "Prices show on the public page once saved." : "Off: paid tiers read “Price to be announced” and free tiers “Free”, as today."}{" "}
            <a href="/welcome#levels" target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-link underline underline-offset-2">
              Open the public page <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </p>
        </div>
      </Panel>

      {tiers.fields.map((f, i) => {
        const id = (n: string) => `tier-${i}-${n}`;
        const p = (n: string) => `tiers.${i}.${n}`;
        const e = (n: string) => fieldError(formState.errors, p(n));
        const v = values.tiers?.[i];
        const name = v?.name || `Tier ${i + 1}`;
        const currency = v?.currency || "USD";
        return (
          <Panel
            key={f.id}
            compact
            title={name}
            description={`Key ${v?.key || "not set"}; ${v?.shown ? "shown" : "hidden"} on the public page.`}
            actions={
              <>
                <Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => tiers.move(i, i - 1)} aria-label={`Move ${name} up`}>
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={i === tiers.fields.length - 1} onClick={() => tiers.move(i, i + 1)} aria-label={`Move ${name} down`}>
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <ConfirmButton label="Remove" title={`Remove the tier ${name}?`} body="It leaves the catalogue when you save. Workspaces on it are not changed by this." confirmLabel="Remove" disabled={tiers.fields.length === 1} onConfirm={() => tiers.remove(i)} />
              </>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field id={id("name")} label="Name" required error={e("name")}>
                <Input id={id("name")} {...register(`tiers.${i}.name`)} {...describe(id("name"), { error: e("name") })} />
              </Field>
              <Field id={id("key")} label="Key" required error={e("key")} hint="Lower case, used by billing and requests.">
                <Input id={id("key")} spellCheck={false} {...register(`tiers.${i}.key`)} {...describe(id("key"), { hint: true, error: e("key") })} />
              </Field>
              <Field id={id("currency")} label="Currency" required error={e("currency")}>
                <Input id={id("currency")} maxLength={3} spellCheck={false} {...register(`tiers.${i}.currency`)} {...describe(id("currency"), { error: e("currency") })} />
              </Field>
              <Field id={id("action")} label="Button">
                <NativeSelect id={id("action")} {...register(`tiers.${i}.action`)}>
                  <option value="request">Request access</option>
                  <option value="run">Run it yourself</option>
                </NativeSelect>
              </Field>
              <Field id={id("priceMonthly")} label="Price a month" error={e("priceMonthly")} hint="Blank: no price yet. 0: free.">
                <MoneyInput id={id("priceMonthly")} currency={currency} {...register(`tiers.${i}.priceMonthly`)} {...describe(id("priceMonthly"), { hint: true, error: e("priceMonthly") })} />
              </Field>
              <Field id={id("priceYearly")} label="Price a year" error={e("priceYearly")}>
                <MoneyInput id={id("priceYearly")} currency={currency} {...register(`tiers.${i}.priceYearly`)} {...describe(id("priceYearly"), { error: e("priceYearly") })} />
              </Field>
              <Field id={id("stripePriceMonthly")} label="Stripe price, monthly" error={e("stripePriceMonthly")}>
                <Input id={id("stripePriceMonthly")} placeholder="price_..." spellCheck={false} {...register(`tiers.${i}.stripePriceMonthly`)} {...describe(id("stripePriceMonthly"), { error: e("stripePriceMonthly") })} />
              </Field>
              <Field id={id("stripePriceYearly")} label="Stripe price, yearly" error={e("stripePriceYearly")}>
                <Input id={id("stripePriceYearly")} placeholder="price_..." spellCheck={false} {...register(`tiers.${i}.stripePriceYearly`)} {...describe(id("stripePriceYearly"), { error: e("stripePriceYearly") })} />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              {(["shown", "paid"] as const).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <Switch id={id(k)} checked={!!v?.[k]} onCheckedChange={(v) => setValue(`tiers.${i}.${k}`, v, { shouldDirty: true })} />
                  <label htmlFor={id(k)} className="text-sm text-primary">{k === "shown" ? "Shown on the public page" : "Paid tier"}</label>
                </div>
              ))}
            </div>
            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-medium text-secondary">Included limits (blank: not set)</legend>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {LIMIT_KEYS.map((k) => (
                  <Field key={k} id={id(`limit-${k}`)} label={LIMIT_LABEL[k]} error={e(`limits.${k}`)}>
                    <Input id={id(`limit-${k}`)} inputMode="numeric" {...register(`tiers.${i}.limits.${k}`)} {...describe(id(`limit-${k}`), { error: e(`limits.${k}`) })} />
                  </Field>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field id={id("who")} label="For whom" error={e("who")}>
                <Input id={id("who")} {...register(`tiers.${i}.who`)} {...describe(id("who"), { error: e("who") })} />
              </Field>
              <Field id={id("what")} label="In one line" error={e("what")}>
                <Input id={id("what")} {...register(`tiers.${i}.what`)} {...describe(id("what"), { error: e("what") })} />
              </Field>
              <Field id={id("includes")} label="Includes (one per line)" error={e("includes")} className="md:col-span-2">
                <Textarea id={id("includes")} rows={4} {...register(`tiers.${i}.includes`)} {...describe(id("includes"), { error: e("includes") })} />
              </Field>
            </div>
          </Panel>
        );
      })}

      <SaveError message={formState.errors.root?.message ?? ""} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={save.isPending || !canWrite}>
          {save.isPending ? "Saving…" : "Save the catalogue"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => tiers.append({ ...BLANK })} disabled={tiers.fields.length >= 12}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add a tier
        </Button>
        {source === "database" ? (
          <ConfirmButton
            label="Reset to built-in"
            title="Go back to the built-in catalogue?"
            body="The saved catalogue is removed and the four built-in levels apply again, with prices hidden. The change is recorded in the audit log."
            confirmLabel="Reset"
            disabled={reset.isPending || !canWrite}
            onConfirm={() => reset.mutate(undefined, { onError: (e) => toast.error(messageOf(e)) })}
          />
        ) : null}
        <SavedNote show={saved} />
      </div>
    </form>
  );
}

/** The message react-hook-form holds for a dotted path, if any. */
function fieldError(errors: unknown, path: string): string | undefined {
  let cur: unknown = errors;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  const m = (cur as { message?: unknown } | undefined)?.message;
  return typeof m === "string" ? m : undefined;
}
