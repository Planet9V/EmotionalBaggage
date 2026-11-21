"use client";

// The print jobs that belong to one build (a print job's buildKey), read from
// GET /api/projects/[id]/print-jobs?buildKey=. Read only: jobs are made and run on 3D printing.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import { statusTone } from "@/lib/statusTones";
import type { Item } from "@/lib/types";

export function BuildPrintJobs({ projectId, buildKey }: { projectId: string; buildKey: string }) {
  const q = useQuery({
    queryKey: ["items", projectId, "print-jobs", buildKey],
    queryFn: ({ signal }) => api<{ jobs: Item[] }>(`/api/projects/${encodeURIComponent(projectId)}/print-jobs?buildKey=${encodeURIComponent(buildKey)}`, { signal }).then((r) => r.jobs),
    enabled: !!buildKey,
  });
  return (
    <section aria-label="Print jobs for this build" className="space-y-1.5">
      <p className="text-xs font-medium text-secondary">Print jobs for this build</p>
      {!buildKey ? (
        <p className="text-xs text-muted">The build has no key yet, so no print job can name it.</p>
      ) : q.isPending ? (
        <p className="text-xs text-muted" role="status">Loading the print jobs.</p>
      ) : q.error ? (
        <p role="alert" className="text-xs text-danger">The print jobs could not be loaded: {messageOf(q.error)} <button type="button" className="underline" onClick={() => void q.refetch()}>Try again</button></p>
      ) : !q.data.length ? (
        <p className="text-xs text-muted">None yet. Choose this build when you make a job on <Link className="text-link underline" href="/s/prototype/printing">3D printing</Link>.</p>
      ) : (
        <ul className="space-y-1">
          {q.data.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge tone={statusTone(j.status)}>{j.status}</StatusBadge>
              <span className="text-primary">{j.title}</span>
              {typeof (j.data.result as { outcome?: string } | undefined)?.outcome === "string" && <span className="text-xs text-secondary">result: {(j.data.result as { outcome: string }).outcome}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
