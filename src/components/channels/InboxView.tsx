"use client";

// Marketing, Replies and comments (plan 8.18, 8.19): mentions on X and comments on Instagram, read when
// the user asks. Replies are drafted by the reasoning model in the brand voice as drafts; an approved
// reply goes to Replies to send, and is sent from there one at a time.
import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/Card";
import { fmtDateTime } from "@/lib/format";
import { DraftButton } from "@/components/drafts/DraftButton";
import type { ViewProps } from "@/components/views/types";
import { useItems } from "@/lib/client";
import { useChannelActions, useChannelStatus } from "@/lib/channels/client";
import { CHANNEL } from "@/lib/channels/schemas";
import { messageOf } from "@/lib/queries";
import { NotConnected, NotRealNote } from "./shared";
import { channelName } from "@/lib/channels/registry";

export function InboxView({ project, section, store }: ViewProps) {
  const { items, loading, error, writeError, patch, reload } = useItems(project.id, store);
  const replies = useItems(project.id, CHANNEL.replies);
  const status = useChannelStatus(project.id);
  const { fetchInbox } = useChannelActions(project.id);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [filter, setFilter] = useState("new");
  const statuses = section.statuses ?? ["new", "answered", "ignored"];

  const replyOf = useMemo(() => {
    const m = new Map<number, { status: string; sent: boolean }>();
    for (const r of replies.items) if (typeof r.data.answers === "number") m.set(r.data.answers, { status: r.status, sent: !!r.data.sent });
    return m;
  }, [replies.items]);
  const shown = items.filter((i) => filter === "all" || i.status === filter).sort((a, b) => String(b.data.at ?? "").localeCompare(String(a.data.at ?? "")));
  const s = status.data;
  const xReady = !!s?.x.configured && !!s?.x.acknowledged;

  const run = (channel: "x" | "instagram") => {
    setNote("");
    setActionError("");
    fetchInbox.mutate(channel, { onSuccess: (r) => setNote(r.message), onError: (e) => setActionError(messageOf(e)) });
  };

  return (
    <div className="animate-enter space-y-6">
      <Card variant="flat" as="section" aria-labelledby="read-h" className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="read-h" className="text-base font-semibold tracking-tight text-primary">Read new messages</h2>
            <p className="text-sm text-secondary">Only when you press a button. Nothing is read in the background.</p>
          </div>
          <DraftButton projectId={project.id} store={CHANNEL.replies} sectionLabel="Replies to send" />
        </div>
        {status.isPending ? (
          <LoadingBlocks rows={1} label="Checking the connections" />
        ) : status.isError ? (
          <LoadError what="The connections" message={messageOf(status.error)} onRetry={() => void status.refetch()} />
        ) : s ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!xReady || fetchInbox.isPending} onClick={() => run("x")}>
                <Download className="h-4 w-4" aria-hidden /> Read X mentions
              </Button>
              <Button variant="outline" size="sm" disabled={!s.instagram.configured || fetchInbox.isPending} onClick={() => run("instagram")}>
                <Download className="h-4 w-4" aria-hidden /> Read Instagram comments
              </Button>
            </div>
            {!s.x.configured ? <NotConnected service={channelName("x")} what="mentions cannot be read" /> : !s.x.acknowledged ? (
              <p className="text-sm text-secondary">
                X bills each mention read. Read X&apos;s cost statement on <Link href="/s/marketing/posting" className="text-link underline">Posting</Link> and tick that you read it first.
              </p>
            ) : null}
            {!s.instagram.configured ? <NotConnected service={channelName("instagram")} what="comments cannot be read" /> : null}
          </div>
        ) : null}
        {fetchInbox.isPending ? <p role="status" className="text-sm text-secondary">Reading.</p> : null}
        {note ? <p role="status" className="text-sm text-success">{note}</p> : null}
        {actionError ? <ErrorLine>{actionError}</ErrorLine> : null}
        <NotRealNote service="Reading X mentions and Instagram comments" />
      </Card>

      <section aria-labelledby="msgs-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="msgs-h" className="text-base font-semibold tracking-tight text-primary">Messages</h2>
          <label className="flex items-center gap-2 text-sm text-secondary">
            Show
            <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40">
              {[...statuses, "all"].map((x) => <option key={x} value={x}>{x}</option>)}
            </NativeSelect>
          </label>
        </div>
        {error ? (
          <LoadError what="The messages" message={error} onRetry={() => reload()} />
        ) : null}
        {writeError ? <ErrorLine>{writeError}</ErrorLine> : null}
        {loading ? (
          <LoadingBlocks rows={2} label="Loading the messages" />
        ) : shown.length === 0 ? (
          <EmptyState title={items.length ? `Nothing ${filter === "all" ? "here" : filter}` : "No messages yet"}>
            {items.length ? "Choose another filter above." : "Press Read X mentions or Read Instagram comments once a connection is set up."}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {shown.map((m) => {
              const r = replyOf.get(m.id);
              return (
                <Card as="li" variant="flat" key={m.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{String(m.data.channel ?? "")}</span>
                      {m.data.author ? <span className="font-medium text-primary">@{String(m.data.author)}</span> : null}
                      {m.data.at ? <span className="font-mono text-xs text-muted">{fmtDateTime(String(m.data.at))}</span> : null}
                      {r ? <StatusBadge tone={r.sent ? "success" : "info"}>{r.sent ? "reply sent" : "reply approved"}</StatusBadge> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      {m.data.url ? (
                        <a href={String(m.data.url)} target="_blank" rel="noreferrer" className="text-xs text-link underline">
                          Open <ExternalLink className="inline h-3 w-3" aria-hidden />
                        </a>
                      ) : null}
                      <label className="sr-only" htmlFor={`st-${m.id}`}>Status of this message</label>
                      <NativeSelect id={`st-${m.id}`} value={m.status} className="h-8 w-36 text-xs" onChange={(e) => void patch(m.id, { status: e.target.value }).catch((x) => setActionError((x as Error).message))}>
                        {statuses.map((x) => <option key={x} value={x}>{x}</option>)}
                      </NativeSelect>
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-primary wrap-anywhere">{m.body}</p>
                </Card>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">
          Approved replies wait in <Link href="/s/marketing/replies" className="text-link underline">Replies to send</Link>.
        </p>
      </section>
    </div>
  );
}
