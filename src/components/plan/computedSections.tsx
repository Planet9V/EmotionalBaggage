"use client";

// The computed sections (GET /api/projects/[id]/report-sections) in the browser: as report blocks for the
// printed report and its Markdown, and as a short list of tables for the overview.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import type { ReportSection } from "@/lib/report/sections";
import type { Block } from "./report";
import { LoadError, LoadingBlocks } from "@/components/ui/states";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function useReportSections(projectId: string) {
  return useQuery({
    // under the concept's items key, so a saved row refreshes it
    queryKey: ["items", projectId, "report-sections"],
    queryFn: ({ signal }) => api<{ sections: ReportSection[] }>(`/api/projects/${encodeURIComponent(projectId)}/report-sections`, { signal }).then((r) => r.sections),
    enabled: !!projectId,
  });
}

/** The sections as report blocks, under one heading, so the page, the print and the Markdown show them alike. */
export function sectionsToBlocks(sections: ReportSection[] | undefined, error = ""): Block[] {
  if (error) return [{ t: "h2", text: "Worked out from the rows", id: "computed" }, { t: "p", text: `Could not be loaded: ${error}` }];
  if (!sections?.length) return [];
  const out: Block[] = [
    { t: "h2", text: "Worked out from the rows", id: "computed" },
    { t: "p", text: "Each section below is computed by the feature that owns it, from the rows recorded in this concept.", muted: true },
  ];
  for (const s of sections) {
    out.push({ t: "h3", text: s.title, id: s.id });
    out.push(...(s.blocks as Block[]));
  }
  return out;
}

/** The overview's list: each section's title, its sentences and its tables. */
export function ComputedSections({ projectId }: { projectId: string }) {
  const q = useReportSections(projectId);
  if (q.isPending) return <LoadingBlocks rows={2} label="Working out the economics, checks and verdicts" />;
  if (q.error) return <LoadError what="The computed sections" message={messageOf(q.error)} onRetry={() => void q.refetch()} />;
  if (!q.data.length) return null;
  return (
    <section aria-labelledby="computed-h" className="space-y-5">
      <h2 id="computed-h" className="text-base font-semibold tracking-tight text-primary">Worked out from the rows</h2>
      {q.data.map((s) => (
        <div key={s.id} className="space-y-2">
          <h3 className="text-sm font-semibold text-primary"><Link href={s.href} className="hover:text-link hover:underline">{s.title}</Link></h3>
          {s.blocks.map((b, i) =>
            b.t === "p" ? (
              <p key={i} className={`max-w-4xl text-sm ${b.muted ? "text-muted" : "text-secondary"}`}>{b.text}</p>
            ) : (
              <Card key={i} variant="flat" className="overflow-hidden">
                <Table aria-label={`${s.title}, scrolls sideways`}>
                  <TableHeader><TableRow className="hover:bg-transparent">{b.head.map((h, j) => <TableHead key={j} scope="col">{h}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {b.rows.slice(0, 12).map((r, ri) => (
                      <TableRow key={ri}>{r.map((c, ci) => <TableCell key={ci} className={`py-1.5 align-top ${(b.mono ?? []).includes(ci) ? "font-mono text-xs" : ""} ${ci === 0 ? "text-primary" : ""}`}>{c}</TableCell>)}</TableRow>
                    ))}
                    {b.foot && <TableRow className="font-semibold hover:bg-transparent">{b.foot.map((c, ci) => <TableCell key={ci} className="py-1.5 text-primary">{c}</TableCell>)}</TableRow>}
                  </TableBody>
                </Table>
                {b.rows.length > 12 && <p className="border-t border-hairline px-3 py-1.5 text-xs text-muted">{b.rows.length - 12} more rows in the report.</p>}
              </Card>
            )
          )}
        </div>
      ))}
    </section>
  );
}
