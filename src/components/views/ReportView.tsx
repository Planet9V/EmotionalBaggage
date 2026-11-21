"use client";

import { Fragment, useMemo, useState } from "react";
import { Download, FileText, Printer, Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildReport, toMarkdown, type Block } from "@/components/plan/report";
import { useConcept, type ConceptPart } from "@/components/plan/useConcept";
import { sectionsToBlocks, useReportSections } from "@/components/plan/computedSections";
import { messageOf } from "@/lib/queries";
import { api, useProject } from "@/lib/client";
import type { FileMeta, Project } from "@/lib/types";
import { downloadFile } from "@/lib/download";
import { fileSlug, fmtBytes } from "@/lib/format";
import { NoConcept } from "@/components/ui/states";
import { ReportProcess } from "@/components/process/ReportProcess";

const PARTS: ConceptPart[] = ["items", "files", "plan", "research", "challenge", "events"];

const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  html, body, .bg-canvas { background: #fff !important; }
  .report-doc, .report-doc * { color: #000 !important; background: transparent !important; box-shadow: none !important; border-color: #bbb !important; }
  .report-doc header { padding-left: 0 !important; padding-right: 0 !important; }
  .report-doc .report-body { padding: 0 !important; }
  .report-doc h2 { break-after: avoid; margin-top: 18pt !important; }
  .report-doc h3 { break-after: avoid; }
  .report-doc tr, .report-doc blockquote { break-inside: avoid; }
  .report-doc table { font-size: 9pt; }
  .report-doc a { text-decoration: underline; }
  .report-doc .overflow-x-auto { overflow: visible !important; }
}
`;

export function ReportView() {
  const { project, loading } = useProject();
  if (!project) {
    return (
      <>
        <PageHeader eyebrow="Whole concept" title="Report" />
        <NoConcept loading={loading} />
      </>
    );
  }
  return <ReportBody key={project.id} project={project} />;
}

function ReportBody({ project }: { project: Project }) {
  const { data, errors, loading, loadedAt, reload } = useConcept(project.id, PARTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<FileMeta | null>(null);
  const [saveError, setSaveError] = useState("");

  const computed = useReportSections(project.id);
  const blocks = useMemo(() => [...buildReport(project, data, errors), ...sectionsToBlocks(computed.data, messageOf(computed.error))], [project, data, errors, computed.data, computed.error]);
  const generatedIso = loadedAt?.toISOString() ?? "";
  const generatedLabel = loadedAt ? loadedAt.toLocaleString(undefined, { dateStyle: "long", timeStyle: "medium" }) : "";
  const stamp = generatedIso.replace(/[:.]/g, "-").slice(0, 19);
  const base = `${fileSlug(project.name)}-report-${stamp}`;
  const ready = !loading && !!loadedAt && !computed.isPending;

  const markdown = () => toMarkdown(project, generatedLabel ? `${generatedLabel} (${generatedIso})` : "", blocks);

  const downloadJson = () => {
    const full = {
      generatedAt: generatedIso,
      project,
      items: data.items,
      files: data.files,
      plan: data.plan,
      research: data.research,
      challenge: data.challenge,
      events: data.events,
      loadErrors: errors,
    };
    downloadFile(`${base}.json`, JSON.stringify(full, null, 2), "application/json");
  };

  const saveToConcept = async () => {
    setSaving(true);
    setSaveError("");
    setSaved(null);
    try {
      const form = new FormData();
      form.append("file", new File([markdown()], `${base}.md`, { type: "text/markdown" }));
      form.append("kind", "report");
      form.append("meta", JSON.stringify({ generatedAt: generatedIso, format: "markdown" }));
      const r = await api<{ file: FileMeta }>(`/api/projects/${encodeURIComponent(project.id)}/files`, { method: "POST", body: form });
      setSaved(r.file);
      await reload();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="report-doc">
      <style>{PRINT_CSS}</style>
      <PageHeader eyebrow="Whole concept · Report" title={project.name} blurb={project.oneLiner}>
        <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!ready}>
          <Printer className="h-3.5 w-3.5" aria-hidden /> Print
        </Button>
        <Button variant="outline" size="sm" onClick={downloadJson} disabled={!ready}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Download JSON
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadFile(`${base}.md`, markdown(), "text/markdown")} disabled={!ready}>
          <FileText className="h-3.5 w-3.5" aria-hidden /> Download Markdown
        </Button>
        <Button size="sm" onClick={() => void saveToConcept()} disabled={!ready || saving}>
          <Save className="h-3.5 w-3.5" aria-hidden /> {saving ? "Saving" : "Save report to concept"}
        </Button>
      </PageHeader>

      <div className="report-body mx-auto max-w-6xl px-8 py-6">
        <p className="font-mono text-[11px] text-muted">
          {loadedAt ? <>Generated {generatedLabel}</> : "Loading everything recorded for this concept."}
        </p>

        {saved && (
          <p className="no-print mt-3 rounded-md border border-hairline bg-success-soft px-3 py-2 text-sm text-success" role="status">
            Saved {saved.name} to the concept ({fmtBytes(saved.size)}, sha256 <span className="font-mono text-xs break-all">{saved.sha256}</span>).
          </p>
        )}
        {saveError && (
          <p className="no-print mt-3 rounded-md border border-hairline bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            The report was not saved: {saveError}
          </p>
        )}

        {ready && (
          <>
            <nav className="no-print mt-5 flex flex-wrap gap-x-4 gap-y-1 border-b border-hairline pb-4 text-xs" aria-label="Report contents">
              {blocks
                .filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2")
                .map((b) => (
                  <a key={b.id} href={`#${b.id}`} className="text-secondary hover:text-link">
                    {b.eyebrow ? `${b.eyebrow.replace("Stage ", "")}. ` : ""}
                    {b.text}
                  </a>
                ))}
            </nav>
            <div className="mt-2">
              {blocks.map((b, i) => (
                <Fragment key={i}>{renderBlock(b)}</Fragment>
              ))}
              <ReportProcess projectId={project.id} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function renderBlock(b: Block) {
  switch (b.t) {
    case "h2":
      return (
        <h2 id={b.id} className="mt-10 scroll-mt-6 border-b border-hairline pb-2 text-xl font-semibold tracking-tight text-primary">
          {b.eyebrow && <span className="mr-3 font-mono text-[11px] font-normal uppercase tracking-[0.2em] text-link">{b.eyebrow}</span>}
          {b.text}
        </h2>
      );
    case "h3":
      return <h3 id={b.id} className="mt-6 scroll-mt-6 text-sm font-semibold tracking-tight text-primary">{b.text}</h3>;
    case "p":
      return <p className={`mt-2 max-w-4xl text-sm ${b.muted ? "text-muted" : "text-secondary"}`}>{b.text}</p>;
    case "empty":
      return <p className="mt-2 text-sm italic text-muted">Nothing recorded</p>;
    case "quote":
      return (
        <blockquote className="mt-3 border-l-2 border-hairline pl-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{b.label}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-secondary">{b.text}</p>
        </blockquote>
      );
    case "links":
      return (
        <ul className="mt-2 space-y-0.5 pl-4 text-xs">
          {b.items.map((l, i) => (
            <li key={i}>
              <a href={l.href} target="_blank" rel="noopener noreferrer" className="break-all text-link hover:underline">{l.text}</a>
            </li>
          ))}
        </ul>
      );
    case "table": {
      const mono = new Set(b.mono ?? []);
      return (
        <div className="mt-2 rounded-xl border border-hairline">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {b.head.map((h, i) => (
                  <TableHead key={i}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.rows.map((r, ri) => (
                <TableRow key={ri}>
                  {r.map((c, ci) => (
                    <TableCell
                      key={ci}
                      className={`align-top ${mono.has(ci) ? "font-mono text-xs" : "text-sm"} ${ci === 0 && !mono.has(0) ? "font-medium text-primary" : ""} ${
                        b.head[ci] === "SHA-256" ? "break-all" : ""
                      } ${b.head[ci] === "Detail" || b.head[ci] === "Other fields" ? "min-w-[16rem] whitespace-pre-line" : ""}`}
                    >
                      {c}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {b.foot && (
                <TableRow className="border-t border-hairline hover:bg-transparent">
                  {b.foot.map((c, ci) => (
                    <TableCell key={ci} className={`font-semibold text-primary ${mono.has(ci) ? "font-mono text-xs" : "text-sm"}`}>{c}</TableCell>
                  ))}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      );
    }
  }
}
