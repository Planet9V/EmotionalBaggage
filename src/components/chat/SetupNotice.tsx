"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { messageOf } from "@/lib/queries";
import { chatKeys, indexConcept, type ChatSetup, type IndexResult } from "./api";

const SEARCH: Record<string, string> = { hnsw: "an HNSW index", binary: "a binary-quantized index with re-ranking", exact: "a comparison of every vector", bits: "a comparison of one-bit copies, the best re-ranked" };

function counts(r: IndexResult) {
  const rows = { indexed: r.indexed - r.research.indexed, skipped: r.skipped - r.research.skipped, failed: r.failed - r.research.failed };
  return `Rows: ${rows.indexed} embedded, ${rows.skipped} unchanged, ${rows.failed} failed. Research answers: ${r.research.indexed} embedded, ${r.research.skipped} unchanged, ${r.research.failed} failed. Model ${r.model}, ${r.dims.toLocaleString()} numbers per text. Index for this width: ${r.index === "exact" ? "none" : (SEARCH[r.index] ?? r.index)}. This concept is searched with ${SEARCH[r.search] ?? r.search}${r.search === "exact" ? " while it has 2,000 vectors or fewer" : ""}.`;
}

/**
 * The not-set-up state. Without a reasoning model there is no chat at all; without vectors for this
 * concept the chat still works, with sources found by matching words, and this says exactly which
 * part is missing, offers to index the concept and links to Admin.
 */
export function SetupNotice({ projectId, setup }: { projectId: string; setup: ChatSetup }) {
  const qc = useQueryClient();
  const index = useMutation({
    mutationFn: () => indexConcept(projectId),
    onSettled: () => qc.invalidateQueries({ queryKey: chatKeys.list(projectId) }),
  });

  const reasoning = setup.reasoning;
  const meaning = setup.meaning;
  if (reasoning.ok && meaning.ok && !index.data) return null;

  return (
    <div className="space-y-2 border-b border-hairline bg-surface px-6 py-3 text-sm" role="status">
      {!reasoning.ok && (
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <Settings className="mt-0.5 h-4 w-4 shrink-0 text-dutchOrange" aria-hidden />
          <p className="min-w-0 flex-1 text-primary">
            <span className="font-medium">Chat is not set up: no reasoning model.</span> <span className="text-secondary">{reasoning.reason}</span>
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin">Open Admin</Link>
          </Button>
        </div>
      )}
      {!meaning.ok && (
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-primary">
              <span className="font-medium">
                {meaning.missing === "unindexed" ? "Search by meaning is not set up: this concept has no embeddings yet." : "Search by meaning is not set up."}
              </span>{" "}
              <span className="text-secondary">{meaning.reason}</span>
            </p>
            <p className="text-xs text-muted">Until it is, sources are found by matching the words of the question.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => index.mutate()} disabled={index.isPending}>
              {index.isPending ? "Indexing" : "Index this concept"}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin">Open Admin</Link>
            </Button>
          </div>
        </div>
      )}
      {index.data && <p className="text-xs text-secondary">Indexed. {counts(index.data)}{index.data.error ? ` First failure: ${index.data.error}` : ""}</p>}
      {index.error && (
        <p role="alert" className="text-xs text-danger">
          Indexing did not run: {messageOf(index.error)}
        </p>
      )}
    </div>
  );
}
