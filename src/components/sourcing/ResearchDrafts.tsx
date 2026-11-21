"use client";

// Research drafts for one part, from the shared drafting engine: each is an offer or an alternate with
// the page it came from, added to the part only when approved here (or in Draft with AI).
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { draftQueries, useDraftActions } from "@/components/drafts/api";
import { messageOf } from "@/lib/queries";

export function ResearchDrafts({ projectId, partId }: { projectId: string; partId: number }) {
  const list = useQuery(draftQueries.list(projectId, "design/bom"));
  const { approve, reject } = useDraftActions(projectId);
  const mine = (list.data?.drafts ?? []).filter((d) => d.status === "draft" && d.itemId === partId && d.generator.startsWith("sourcing."));
  const err = messageOf(approve.error) || messageOf(reject.error);
  if (list.isPending) return <LoadingBlocks rows={1} label="Loading research drafts" />;
  if (list.error) return <LoadError what="Research drafts" message={messageOf(list.error)} onRetry={() => void list.refetch()} />;
  if (!mine.length) return <p className="text-sm text-secondary">No drafts waiting. A draft is a suggestion with the page it came from. It counts as nothing until you accept it.</p>;
  return (
    <ul className="space-y-2" aria-label="Research drafts waiting for review">
      {err && <li><ErrorLine>{err}</ErrorLine></li>}
      {mine.map((d) => {
        const url = d.sources[0]?.title ?? "";
        let host = "";
        try { host = new URL(url).hostname; } catch { host = ""; }
        return (
          <li key={d.id} className="rounded-lg border border-dashed border-hairline p-3 text-sm">
            <p className="font-medium text-primary">{d.title}<span className="ml-2 font-mono text-[11px] font-normal text-muted">draft</span></p>
            <p className="text-xs text-secondary">
              {d.body ? `${d.body} · ` : ""}
              {host ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">{host}</a> : "no page"} · {d.model || "research"}
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(d.id)}>{d.op.field === "sourcing.offers" ? "Accept as offer" : "Accept as alternate"}</Button>
              <Button size="sm" variant="ghost" disabled={reject.isPending} onClick={() => reject.mutate({ id: d.id, reason: "discarded on Sourcing" })}>Discard</Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
