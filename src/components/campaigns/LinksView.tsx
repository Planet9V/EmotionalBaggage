"use client";

import { useMemo, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useItems } from "@/lib/client";
import { MEDIA } from "@/lib/campaigns/links";
import { campaignsOf } from "@/lib/campaigns/read";
import { CAMPAIGN_STORE } from "@/lib/campaigns/schemas";
import type { ViewProps } from "@/components/views/types";
import { useChangeLink, useLinks, useMakeLink, type LinkView } from "./hooks";
import { QrCode } from "./QrCode";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";

// What the server refuses (an address that is not http or https, a host outside the allowed list) comes back as the form's error.
const linkSchema = z.object({
  campaign: z.string(),
  creative: z.string(),
  baseUrl: z.string(),
  source: z.string(),
  medium: z.enum(MEDIA),
  term: z.string(),
  short: z.boolean(),
});

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

export function LinksView({ project }: ViewProps) {
  const store = useItems(project.id, CAMPAIGN_STORE);
  const ads = useItems(project.id, "marketing/ads").items;
  const posts = useItems(project.id, "marketing/social").items;
  const links = useLinks(project.id);
  const make = useMakeLink(project.id);
  const change = useChangeLink(project.id);
  const campaigns = useMemo(() => campaignsOf(store.items), [store.items]);
  const { register, control, handleSubmit, setValue, setError, formState: { errors } } = useForm<z.infer<typeof linkSchema>>({
    resolver: zodResolver(linkSchema),
    defaultValues: { campaign: "", creative: "", baseUrl: "", source: "", medium: "cpc", term: "", short: true },
  });
  const [chosenCampaign, chosenCreative] = useWatch({ control, name: ["campaign", "creative"] });
  const setErr = (message: string) => setError("root", { message });
  const [notes, setNotes] = useState<string[]>([]);
  const [qr, setQr] = useState<number | null>(null);
  const [copied, setCopied] = useState("");

  if (store.loading || links.loading) return <LoadingBlocks label="Loading tracked links" />;
  if (links.error) return <LoadError what="Tracked links" message={links.error} onRetry={links.retry} />;
  const campaign = campaigns.find((c) => String(c.id) === chosenCampaign) ?? campaigns[0] ?? null;
  const ids = new Set((campaign?.creative ?? []).map((r) => r.itemId));
  const creatives = [...ads, ...posts].filter((x) => ids.has(x.id));
  const title = (id: number) => campaigns.find((c) => c.id === id)?.title ?? `Campaign #${id}`;

  const submit = handleSubmit(async (v) => {
    setNotes([]);
    if (!campaign) return setErr("Add a campaign first.");
    try {
      const r = await make.mutateAsync({ campaignId: campaign.id, creativeId: v.creative ? Number(v.creative) : null, baseUrl: v.baseUrl, source: v.source, medium: v.medium, utmTerm: v.term || undefined, short: v.short });
      setNotes(r.notes);
      setValue("baseUrl", "");
      setValue("term", "");
    } catch (e) {
      setErr((e as Error).message);
    }
  });
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
    } catch {
      setErr("The browser would not copy. Select the address and copy it by hand.");
    }
  };

  return (
    <div className="space-y-8">
      <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-primary">Make a tracked link</h2>
          <p className="mt-1 text-sm text-secondary">The address you give an ad or a post, with UTM parameters added in one convention. The short address sends a visitor to the page you save here, and counts one click a day, with nothing about who clicked.</p>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-sm text-secondary">There is no campaign yet. Add one in <Link className="text-link underline" href="/s/marketing/campaigns">Campaigns</Link>, then make its links here.</p>
        ) : (
          <form id="new-link" noValidate className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(e) => void submit(e)}>
            <Field label="Campaign"><NativeSelect value={campaign?.id ? String(campaign.id) : ""} onChange={(e) => { setValue("campaign", e.target.value); setValue("creative", ""); }}>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</NativeSelect></Field>
            <Field label="Creative (optional)"><NativeSelect value={chosenCreative} onChange={(e) => setValue("creative", e.target.value)}><option value="">The whole campaign</option>{creatives.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</NativeSelect></Field>
            <Field label="Page it goes to" className="sm:col-span-2" hint="A web address starting http:// or https://"><Input placeholder="https://example.com/product" {...register("baseUrl")} /></Field>
            <Field label="Source (utm_source)" hint="Where the click comes from: meta, amazon-ads, email."><Input {...register("source")} /></Field>
            <Field label="Medium (utm_medium)"><NativeSelect {...register("medium")}>{MEDIA.map((m) => <option key={m}>{m}</option>)}</NativeSelect></Field>
            <Field label="Term (utm_term, optional)"><Input {...register("term")} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm text-primary"><input type="checkbox" className="h-4 w-4 accent-dutchOrange" {...register("short")} /> Also make a short address that counts clicks</label>
            <div className="sm:col-span-2 xl:col-span-4"><Button type="submit" disabled={make.isPending}>{make.isPending ? "Making" : "Make the link"}</Button></div>
          </form>
        )}
        {errors.root?.message && <ErrorLine>{errors.root.message}</ErrorLine>}
        {notes.length > 0 && <ul role="status" className="list-disc pl-5 text-sm text-secondary">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        <details className="text-sm text-secondary">
          <summary className="cursor-pointer text-xs font-medium">The naming convention</summary>
          <ul className="mt-1 list-disc pl-5">{(links.data?.convention ?? []).map((c, i) => <li key={i}>{c}</li>)}</ul>
        </details>
      </Card>

      {!links.data?.links.length ? (
        <EmptyState title="No tracked links yet">Make one above. Paste its address into the ad or post, and the clicks the short address counts appear on Campaign results.</EmptyState>
      ) : (
        <ul className="space-y-3" aria-label="Tracked links">
          {links.data.links.map((l: LinkView) => {
            const full = l.shortPath ? `${origin()}${l.shortPath}` : "";
            return (
              <li key={l.id}>
                <Card variant="outlined" hoverEffect={false} innerClassName="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-primary">{title(l.campaignId)}{l.creativeLabel ? ` / ${l.creativeLabel}` : ""}</p>
                      <p className="text-xs text-secondary">{l.utm.source} / {l.utm.medium}. Made {new Date(l.createdAt).toISOString().slice(0, 10)}{l.createdBy ? ` by ${l.createdBy}` : ""}.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {l.code && <StatusBadge tone={l.disabled ? "warning" : "success"}>{l.disabled ? "Short address off" : `${l.clicks} ${l.clicks === 1 ? "click" : "clicks"} counted`}</StatusBadge>}
                      {l.code && <Button size="sm" variant="outline" onClick={() => change.mutate({ id: l.id, disabled: !l.disabled })}>{l.disabled ? "Turn on" : "Turn off"}</Button>}
                      <Button size="sm" variant="ghost" aria-label="Delete this link" onClick={() => { if (window.confirm("Delete this link and its click counts? The short address stops working.")) change.mutate({ id: l.id, remove: true }); }}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                    </div>
                  </div>
                  {l.code && <AddressRow label="Short address" value={full} copied={copied === full} onCopy={() => void copy(full)} />}
                  <AddressRow label="Page with UTM parameters" value={l.destination} copied={copied === l.destination} onCopy={() => void copy(l.destination)} />
                  {l.code && (
                    <div>
                      <Button size="sm" variant="outline" aria-expanded={qr === l.id} onClick={() => setQr(qr === l.id ? null : l.id)}>{qr === l.id ? "Hide the QR code" : "Show a QR code"}</Button>
                      {qr === l.id && <div className="mt-2"><QrCode value={full} label={`qr-${l.code}`} /><p className="mt-1 max-w-md text-xs text-muted">The code holds {full}. It only works for people who can reach that address, so print it only from the app&apos;s public address, not from localhost.</p></div>}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddressRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-44 shrink-0 text-xs text-secondary">{label}</span>
      <code className="min-w-0 flex-1 break-all rounded bg-subtle px-2 py-1 text-xs text-primary">{value}</code>
      <Button size="sm" variant="ghost" onClick={onCopy} aria-label={`Copy ${label}`}><Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Copied" : "Copy"}</Button>
    </div>
  );
}
