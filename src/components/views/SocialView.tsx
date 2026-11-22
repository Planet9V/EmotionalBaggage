"use client";

import { RowActions } from "@/components/drafts/RowActions";
import { sentText } from "@/lib/channels/sentText";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useItems } from "@/lib/client";
import { messageOf, queries, type Integration, type IntegrationsReport } from "@/lib/queries";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SOCIAL_CHANNELS, checkSocial, socialChannel } from "@/lib/content/channels";
import { SocialCalendar } from "@/components/content/SocialCalendar";
import type { ViewProps } from "./types";
import { ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { describe, Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/Card";
import { Kanban } from "@/components/items/Kanban";
import { statusesFor } from "@/lib/menuLookup";
import { channelName } from "@/lib/channels/registry";

const NO_INTEGRATIONS: Integration[] = [];
const socialOnly = (r: IntegrationsReport) => r.integrations.filter((i) => i.key === "x" || i.key === "instagram");

const CHANNELS = [...SOCIAL_CHANNELS.map((c) => c.label), "other"];
const X_NAME = channelName("x");
const X_LIMIT = 280;
const len = (s: string) => Array.from(s).length;
const channelOf = (it: Item) => (typeof it.data.channel === "string" && it.data.channel ? it.data.channel : "other");
const firstLine = (t: string) => {
  const l = t.trim().split("\n")[0];
  return l.length > 60 ? `${l.slice(0, 57)}...` : l;
};

export function SocialView({ project, section, store }: ViewProps) {
  const { items, loading, error, writeError, add, patch, remove } = useItems(project.id, store);
  const columns = statusesFor(store);
  const integQuery = useQuery({ ...queries.integrations(), select: socialOnly });
  const integ = integQuery.data ?? NO_INTEGRATIONS;
  const integError = messageOf(integQuery.error);
  const [compose, setCompose] = useState<{ item: Item | null } | null>(null);
  const [del, setDel] = useState<Item | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [tab, setTab] = useState<"board" | "calendar">("board");

  const move = (it: Item, status: string) => {
    if (it.status !== status) void patch(it.id, { status });
  };
  const copy = async (it: Item) => {
    try {
      await navigator.clipboard.writeText(it.body);
      setCopied(it.id);
      setTimeout(() => setCopied((c) => (c === it.id ? null : c)), 1800);
    } catch {
      setActionError("The browser blocked copying. Select the text and copy it by hand.");
    }
  };

  return (
    <div className="animate-enter space-y-5">
      <Card variant="flat" as="section" aria-label="Connections" className="p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {integ.map((i) => (
            <span key={i.key} className="flex items-center gap-2 text-sm text-primary">
              {i.name}
              <StatusBadge tone={i.configured ? "info" : "neutral"}>{i.configured ? "Credentials present" : "Not connected"}</StatusBadge>
            </span>
          ))}
          {integError ? <span className="text-sm text-danger">{integError}</span> : null}
        </div>
        <p className="mt-2 text-sm text-secondary">
          An approved post to X or Instagram is sent from Marketing, Posting, one at a time after you confirm it. For other channels, copy an approved post, publish it yourself, then move it to posted by hand.
        </p>
      </Card>

      <div role="group" aria-label="Social view" className="flex gap-2">
        <Button size="sm" variant={tab === "board" ? "default" : "outline"} aria-pressed={tab === "board"} onClick={() => setTab("board")}>Board</Button>
        <Button size="sm" variant={tab === "calendar" ? "default" : "outline"} aria-pressed={tab === "calendar"} onClick={() => setTab("calendar")}>Calendar</Button>
      </div>
      {tab === "calendar" ? (
        <>
          {error ? <ErrorLine>{error}</ErrorLine> : null}
          {writeError ? <ErrorLine>{writeError}</ErrorLine> : null}
          {loading ? <LoadingBlocks rows={2} label="Loading the posts" /> : <SocialCalendar items={items} onPatch={(id, c) => patch(id, c)} />}
        </>
      ) : (<>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Drag a post to another column, or use the buttons on the post.</p>
        <Button onClick={() => setCompose({ item: null })}><Plus className="h-4 w-4" aria-hidden /> {section.addLabel ?? "Add draft post"}</Button>
      </div>
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      {actionError || writeError ? <ErrorLine>{actionError || writeError}</ErrorLine> : null}

      {loading ? (
        <LoadingBlocks rows={2} label="Loading the posts" />
      ) : (
        <Kanban
          items={items}
          statuses={columns}
          columns={[]}
          onOpen={(id) => setCompose({ item: items.find((x) => x.id === id) ?? null })}
          onMove={(id, status) => patch(id, { status })}
          emptyHint="Nothing here."
          renderCard={(p, grip) => {
            const ch = channelOf(p);
            const n = len(p.body);
            const ci = columns.indexOf(p.status);
            const col = p.status;
            return (
              <>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                    {grip} {ch}
                  </span>
                  {ch === X_NAME && (
                    <span className={cn("font-mono text-[11px]", n > X_LIMIT ? "text-danger" : "text-muted")} ><span aria-hidden>{n}/{X_LIMIT}</span><span className="sr-only">{`${n} of ${X_LIMIT} characters`}</span></span>
                  )}
                </div>
                <p className="whitespace-pre-wrap wrap-break-word text-sm text-primary">{p.body || p.title}</p>
                {sentText(p.data) ? <p className="mt-1 text-[11px] text-muted">{sentText(p.data).replace(/^./, (c) => c.toUpperCase())}.</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {ci > 0 && (
                    <Button size="chip" variant="outline" onClick={() => move(p, columns[ci - 1])} aria-label={`Move to ${columns[ci - 1]}`}>
                      <ArrowLeft className="h-3 w-3" aria-hidden /> {columns[ci - 1]}
                    </Button>
                  )}
                  {ci < columns.length - 1 && (
                    <Button size="chip" variant="outline" onClick={() => move(p, columns[ci + 1])} aria-label={`Move to ${columns[ci + 1]}`}>
                      {columns[ci + 1] === "posted" ? "Mark as posted" : columns[ci + 1]} <ArrowRight className="h-3 w-3" aria-hidden />
                    </Button>
                  )}
                  {col === "approved" && (
                    <Button size="chip" variant="subtle" onClick={() => void copy(p)}>
                      {copied === p.id ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />} {copied === p.id ? "Copied" : "Copy"}
                    </Button>
                  )}
                  <span className="ml-auto flex">
                    <RowActions item={p} label={`the ${ch} post ${p.title}`} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit post" onClick={() => setCompose({ item: p })}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Delete post" onClick={() => setDel(p)}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                  </span>
                </div>
              </>
            );
          }}
        />
      )}
      {!loading && items.some((i) => !columns.includes(i.status)) && (
        <p className="text-xs text-warning">Some posts have a status that is not a column here, so they are not shown.</p>
      )}
      </>)}

      {compose && (
        <ComposeDialog
          key={compose.item?.id ?? "new"}
          item={compose.item}
          onClose={() => setCompose(null)}
          onSave={async (v) => {
            if (compose.item) await patch(compose.item.id, { title: firstLine(v.text), body: v.text, data: { channel: v.channel } });
            else await add({ section: store, title: firstLine(v.text), body: v.text, status: columns[0], data: { channel: v.channel } });
          }}
        />
      )}
      <Modal open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this post?" description="This cannot be undone. A post you already published stays published.">
        <p className="line-clamp-3 text-sm text-primary">{del?.body || del?.title}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDel(null)}>Keep it</Button>
          <Button onClick={async () => {
            if (!del) return;
            try { setActionError(""); await remove(del.id); } catch (e) { setActionError((e as Error).message); }
            setDel(null);
          }}>Delete post</Button>
        </div>
      </Modal>
    </div>
  );
}

const POST_TEXT_ID = "compose-post-text";

// The character count and the channel's limits are shown as you type; they warn, they do not block.
const composeSchema = z.object({
  channel: z.string(),
  text: z.string().refine((v) => v.trim() !== "", "Write the post first."),
});
type ComposeValues = z.infer<typeof composeSchema>;

function ComposeDialog({ item, onClose, onSave }: { item: Item | null; onClose: () => void; onSave: (v: { text: string; channel: string }) => Promise<void> }) {
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting: busy } } = useForm<ComposeValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: { channel: item ? channelOf(item) : X_NAME, text: item?.body ?? "" },
  });
  const [channel, text] = useWatch({ control, name: ["channel", "text"] });
  const n = len(text);

  const submit = handleSubmit(async (v) => {
    try {
      await onSave({ text: v.text, channel: v.channel });
      onClose();
    } catch (x) {
      setError("root", { message: (x as Error).message });
    }
  });

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={item ? "Edit post" : "New draft post"}>
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        <Field label="Channel">
          <NativeSelect {...register("channel")}>{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</NativeSelect>
        </Field>
        <Field id={POST_TEXT_ID} label="Post text" error={errors.text?.message}>
          <Textarea id={POST_TEXT_ID} rows={6} autoFocus {...describe(POST_TEXT_ID, { error: errors.text?.message })} {...register("text")} />
        </Field>
        {channel === X_NAME && (
          <p className={cn("font-mono text-xs", n > X_LIMIT ? "text-danger" : "text-muted")} aria-live="polite">
            {n}/{X_LIMIT} characters{n > X_LIMIT ? `, ${n - X_LIMIT} over the limit` : ""}
          </p>
        )}
        {channel !== X_NAME && socialChannel(channel) && (
          <ul className="space-y-0.5 text-xs" aria-live="polite">
            <li className="font-mono text-muted">{n} characters</li>
            {checkSocial(socialChannel(channel)!, text).map((p, i) => <li key={i} className={p.level === "refuse" ? "text-danger" : "text-warning"}>{p.message}</li>)}
          </ul>
        )}
        {errors.root?.message ? <ErrorLine>{errors.root.message}</ErrorLine> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving" : item ? "Save post" : "Save draft"}</Button>
        </div>
      </form>
    </Modal>
  );
}
