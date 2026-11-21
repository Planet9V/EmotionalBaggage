"use client";

// Marketing, Posting (plan 8.18, 8.19): the approved and scheduled posts of Marketing, Social for X and
// Instagram, each sent only by its own button and confirmation. A scheduled date is a reminder: nothing
// is posted automatically.
import Link from "next/link";
import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorLine } from "@/components/parts/controls";
import type { ViewProps } from "@/components/views/types";
import { useItems } from "@/lib/client";
import { useChannelStatus } from "@/lib/channels/client";
import { channelOf } from "@/lib/channels/channelName";
import { messageOf } from "@/lib/queries";
import type { Item } from "@/lib/types";
import { CostStatement, NotConnected, NotRealNote, SendDialog } from "./shared";

const READY = new Set(["approved", "scheduled"]);

function Row({ item, onSend }: { item: Item; onSend: () => void }) {
  const ch = channelOf(item.data.channel);
  const sent = item.data.sent as { id?: string; at?: string; url?: string } | undefined;
  const err = item.data.sendError as { message?: string } | undefined;
  const when = typeof item.data.scheduledAt === "string" && item.data.scheduledAt ? item.data.scheduledAt : "";
  return (
    <li className="rounded-xl border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{ch === "x" ? "X" : "Instagram"}</span>
          <StatusBadge tone={sent ? "success" : "info"}>{sent ? "sent" : item.status}</StatusBadge>
          {when && !sent ? <span className="font-mono text-xs text-muted">planned for {when}</span> : null}
        </span>
        {sent ? (
          <span className="text-xs text-secondary">
            Sent {sent.at ? new Date(sent.at).toLocaleString() : ""}
            {sent.url ? (
              <>
                {" "}
                · <a href={sent.url} target="_blank" rel="noreferrer" className="text-link hover:underline">open</a>
              </>
            ) : null}
          </span>
        ) : (
          <Button size="sm" onClick={onSend} aria-label={`Send the post "${item.title}" to ${ch === "x" ? "X" : "Instagram"}`}>
            <Send className="h-4 w-4" aria-hidden /> Send to {ch === "x" ? "X" : "Instagram"}
          </Button>
        )}
      </div>
      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-primary wrap-anywhere">{item.body || item.title}</p>
      {err?.message && !sent ? <p className="mt-2 text-xs text-danger">Last attempt failed: {err.message}</p> : null}
    </li>
  );
}

export function PostingView({ project, store }: ViewProps) {
  const { items, loading, error, reload } = useItems(project.id, store);
  const status = useChannelStatus(project.id);
  const [sending, setSending] = useState<number | null>(null);

  const ours = useMemo(() => items.filter((i) => channelOf(i.data.channel)), [items]);
  const ready = ours.filter((i) => READY.has(i.status) && !i.data.sent);
  const sent = ours.filter((i) => !!i.data.sent).sort((a, b) => String((b.data.sent as { at?: string }).at ?? "").localeCompare(String((a.data.sent as { at?: string }).at ?? "")));
  const waiting = ours.filter((i) => !READY.has(i.status) && !i.data.sent).length;
  const s = status.data;

  return (
    <div className="space-y-6">
      <section aria-labelledby="conn-h" className="space-y-3 rounded-xl border border-hairline bg-surface p-5">
        <h2 id="conn-h" className="text-base font-semibold tracking-tight text-primary">Connections</h2>
        {status.isPending ? (
          <Skeleton className="h-10 w-full bg-subtle" />
        ) : status.isError ? (
          <div className="flex items-center gap-2"><ErrorLine>{messageOf(status.error)}</ErrorLine><Button size="sm" variant="outline" onClick={() => void status.refetch()}>Try again</Button></div>
        ) : s ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2 font-medium text-primary">X <StatusBadge tone={s.x.configured ? "success" : "neutral"}>{s.x.configured ? `Connected${s.x.account ? ` as ${s.x.account}` : ""}` : "Not connected"}</StatusBadge></p>
              {!s.x.configured ? <NotConnected service="X" what="nothing can be posted there" /> : null}
            </div>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2 font-medium text-primary">Instagram <StatusBadge tone={s.instagram.configured ? "success" : "neutral"}>{s.instagram.configured ? "Credentials saved" : "Not connected"}</StatusBadge></p>
              {!s.instagram.configured ? <NotConnected service="Instagram" what="nothing can be published there" /> : <p className="text-secondary">Each post needs a public JPEG address: Instagram fetches the image itself.</p>}
            </div>
          </div>
        ) : null}
        {s ? <CostStatement projectId={project.id} status={s} /> : null}
        <NotRealNote service="Posting to X and Instagram" />
      </section>

      <section aria-labelledby="ready-h" className="space-y-3">
        <div>
          <h2 id="ready-h" className="text-base font-semibold tracking-tight text-primary">Ready to send</h2>
          <p className="text-sm text-secondary">
            Approved and scheduled posts for X and Instagram from{" "}
            <Link href="/s/marketing/social" className="text-link hover:underline">Social</Link>. Each one goes only when you press its button and confirm. A planned date is a reminder; nothing is posted on its own.
          </p>
        </div>
        {error ? (
          <div className="flex items-center gap-2"><ErrorLine>{error}</ErrorLine><Button size="sm" variant="outline" onClick={() => reload()}>Try again</Button></div>
        ) : loading ? (
          <div className="space-y-2" aria-label="Loading the posts"><Skeleton className="h-24 w-full bg-subtle" /><Skeleton className="h-24 w-full bg-subtle" /></div>
        ) : ready.length === 0 ? (
          <EmptyState title="Nothing approved to send">
            Approve a post for X or Instagram in <Link href="/s/marketing/social" className="text-link hover:underline">Social</Link> and it appears here.
            {waiting ? ` ${waiting} ${waiting === 1 ? "post is" : "posts are"} still waiting for approval.` : ""}
          </EmptyState>
        ) : (
          <ul className="space-y-2">{ready.map((i) => <Row key={i.id} item={i} onSend={() => setSending(i.id)} />)}</ul>
        )}
      </section>

      {sent.length ? (
        <section aria-labelledby="sent-h" className="space-y-3">
          <h2 id="sent-h" className="text-base font-semibold tracking-tight text-primary">Sent from this app</h2>
          <ul className="space-y-2">{sent.map((i) => <Row key={i.id} item={i} onSend={() => undefined} />)}</ul>
        </section>
      ) : null}

      {sending !== null ? <SendDialog projectId={project.id} kind="post" itemId={sending} onClose={() => setSending(null)} /> : null}
    </div>
  );
}
