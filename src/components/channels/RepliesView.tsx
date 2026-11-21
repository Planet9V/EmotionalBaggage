"use client";

// Marketing, Replies to send (plan 8.18 to 8.20). Approved replies: X and Instagram replies are sent one
// at a time by their own button and confirmation; replies to reviews (Amazon and elsewhere) are never
// sent by this app: copy them and post them yourself, then mark them sent.
import { SectionEmpty } from "@/components/drafts/SectionEmpty";
import { useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/Card";
import type { ViewProps } from "@/components/views/types";
import { useItems } from "@/lib/client";
import { channelOf, sendName } from "@/lib/channels/channelName";
import { statusTone } from "@/lib/statusTones";
import type { Item } from "@/lib/types";
import { NotRealNote, SendDialog } from "./shared";

export function RepliesView({ project, section, store }: ViewProps) {
  const { items, loading, error, writeError, patch, reload } = useItems(project.id, store);
  const [sending, setSending] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [filter, setFilter] = useState("approved");
  const statuses = section.statuses ?? ["approved", "sent", "withdrawn"];
  const shown = items.filter((i) => filter === "all" || i.status === filter);

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
    <div className="animate-enter space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="max-w-3xl text-sm text-secondary">
          Drafted replies appear here once you approve them (Draft with AI, above). A reply to X or Instagram is sent only when you press its button and confirm. A reply to a review is never sent by this app: copy it and post it where the review was left.
        </p>
        <label className="flex items-center gap-2 text-sm text-secondary">
          Show
          <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} className="w-36">
            {[...statuses, "all"].map((x) => <option key={x} value={x}>{x}</option>)}
          </NativeSelect>
        </label>
      </div>
      {error ? <LoadError what="The replies" message={error} onRetry={() => reload()} /> : null}
      {actionError || writeError ? <ErrorLine>{actionError || writeError}</ErrorLine> : null}
      {loading ? (
        <LoadingBlocks rows={2} label="Loading the replies" />
      ) : shown.length === 0 ? (
        <SectionEmpty projectId={project.id} store="marketing/replies" sectionLabel="Replies" title={items.length ? `No ${filter === "all" ? "" : `${filter} `}replies` : "No replies yet"}>
          {items.length ? "Choose another filter above." : "Use Draft with AI to draft replies to mentions, comments, reviews and questions, then approve the ones you want."}
        </SectionEmpty>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => {
            const ch = channelOf(r.data.channel);
            const sent = r.data.sent as { id?: string; at?: string; url?: string; byHand?: boolean } | undefined;
            const err = r.data.sendError as { message?: string } | undefined;
            return (
              <Card as="li" variant="flat" key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{String(r.data.channel ?? "Other")}</span>
                    <StatusBadge tone={statusTone(r.status === "sent" ? "done" : r.status)}>{r.status}</StatusBadge>
                    {sent?.byHand ? <span className="text-xs text-secondary">marked sent by hand, not sent by the app</span> : null}
                    {sent?.url ? <a href={sent.url} target="_blank" rel="noreferrer" className="text-xs text-link underline">open on {sendName(ch)}</a> : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    {ch && r.status === "approved" && !sent ? (
                      <Button size="sm" onClick={() => setSending(r.id)} aria-label={`Send the reply "${r.title}"`}>
                        <Send className="h-4 w-4" aria-hidden /> Send to {sendName(ch)}
                      </Button>
                    ) : null}
                    {!ch ? (
                      <Button size="sm" variant="outline" onClick={() => void copy(r)}>
                        {copied === r.id ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied === r.id ? "Copied" : "Copy"}
                      </Button>
                    ) : null}
                    {!ch && r.status === "approved" ? (
                      <Button size="sm" variant="outline" onClick={() => void patch(r.id, { status: "sent" }).catch((e) => setActionError((e as Error).message))}>Mark as posted by hand</Button>
                    ) : null}
                    {r.status === "approved" && !sent ? (
                      <Button size="sm" variant="ghost" onClick={() => void patch(r.id, { status: "withdrawn" }).catch((e) => setActionError((e as Error).message))}>Withdraw</Button>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{r.title}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-primary wrap-anywhere">{r.body}</p>
                {typeof r.data.reasoning === "string" && r.data.reasoning ? <p className="mt-1 text-xs text-secondary">Why: {r.data.reasoning}</p> : null}
                {err?.message && !sent ? <p className="mt-1 text-xs text-danger">Last attempt failed: {err.message}</p> : null}
              </Card>
            );
          })}
        </ul>
      )}
      <NotRealNote service="Sending replies to X and Instagram" />
      {sending !== null ? <SendDialog projectId={project.id} kind="reply" itemId={sending} onClose={() => setSending(null)} /> : null}
    </div>
  );
}
