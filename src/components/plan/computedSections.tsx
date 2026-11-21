"use client";

// The computed sections (GET /api/projects/[id]/report-sections) in the browser: as report blocks for the
// printed report and its Markdown, and as a short list of tables for the overview.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import type { ReportSection } from "@/lib/report/sections";
import type { Block } from "./report";

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
  if (q.isPending) return <p className="text-sm text-muted" role="status">Working out the economics, checks and verdicts.</p>;
  if (q.error) return <p role="alert" className="text-sm text-danger">The computed sections could not be loaded: {messageOf(q.error)} <button type="button" className="underline" onClick={() => void q.refetch()}>Try again</button></p>;
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
              <div key={i} className="overflow-x-auto rounded-xl border border-hairline">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-hairline text-left text-xs text-secondary">{b.head.map((h, j) => <th key={j} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                  <tbody>
                    {b.rows.slice(0, 12).map((r, ri) => (
                      <tr key={ri} className="border-b border-hairline last:border-0">{r.map((c, ci) => <td key={ci} className={`px-3 py-1.5 align-top ${(b.mono ?? []).includes(ci) ? "font-mono text-xs" : ""} ${ci === 0 ? "text-primary" : "text-secondary"}`}>{c}</td>)}</tr>
                    ))}
                    {b.foot && <tr className="font-semibold text-primary">{b.foot.map((c, ci) => <td key={ci} className="px-3 py-1.5">{c}</td>)}</tr>}
                  </tbody>
                </table>
                {b.rows.length > 12 && <p className="px-3 py-1.5 text-xs text-muted">{b.rows.length - 12} more rows in the report.</p>}
              </div>
            )
          )}
        </div>
      ))}
    </section>
  );
}
