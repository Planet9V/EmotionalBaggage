"use client";

/**
 * Design > Enclosure when the concept's enclosure is an authored design (src/lib/enclosure/authored.ts): its
 * renders and its files from the concept's Files, the checks its own maker ran, and the way back to the
 * generators. The generator controls are not shown: they would build a different enclosure.
 */
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ErrorLine } from "@/components/ui/states";
import { useItems } from "@/lib/client";
import { authoredFiles, type AuthoredEnclosure } from "@/lib/enclosure/authored";
import { SOURCES_STORE } from "@/lib/story/parts";
import { fmtBytes } from "@/lib/format";

const mm = (n: number) => `${Math.round(n * 10) / 10}`;

type Stored = { id: number; size: number | null };

export function AuthoredView({ projectId, design, onUseGenerator }: { projectId: string; design: AuthoredEnclosure; onUseGenerator: () => Promise<void> }) {
  const files = useItems(projectId, SOURCES_STORE);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  // a file the design names, as it is stored in Files (by its title there)
  const stored = new Map<string, Stored>();
  for (const r of files.items) {
    const d = r.data as { fileId?: unknown; size?: unknown };
    if (typeof d.fileId === "number") stored.set(r.title, { id: d.fileId, size: typeof d.size === "number" ? d.size : null });
  }
  const missing = authoredFiles(design).filter((f) => !stored.has(f));
  const failed = design.checks.filter((c) => !c.ok);
  const download = (name: string, what: string) => {
    const f = stored.get(name);
    return (
      <li key={name} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline py-1.5 first:border-t-0">
        <span className="min-w-0 text-sm text-primary wrap-anywhere">
          {what}: {name}
        </span>
        {f ? (
          <a href={`/api/files/${f.id}`} className="text-sm text-link underline" download>
            Download{f.size ? ` (${fmtBytes(f.size)})` : ""}
          </a>
        ) : (
          <span className="text-sm text-secondary">Not in Files</span>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4" data-testid="authored-enclosure">
      <Panel
        compact
        title="Authored design"
        description={
          <>
            {design.name}
            {design.size ? `, ${design.size.map(mm).join(" by ")} mm outside` : ""}. {design.designedBy ? `${design.designedBy[0].toUpperCase()}${design.designedBy.slice(1)}. ` : ""}
            {design.decision ? (
              <>
                Chosen in <Link href="/s/concept/decisions" className="text-link underline">Decisions</Link>: {design.decision}
              </>
            ) : null}
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={switching}
            onClick={async () => {
              setSwitching(true);
              setError("");
              try {
                await onUseGenerator();
              } catch {
                setError("The choice was not saved.");
              } finally {
                setSwitching(false);
              }
            }}
          >
            Use a generator instead
          </Button>
        }
      >
        <p className="text-sm text-secondary">
          The enclosure generators are not shown: this enclosure was designed outside them, and its files are in{" "}
          <Link href="/files" className="text-link underline">Files</Link>. Print it from{" "}
          <Link href="/s/prototype/printing" className="text-link underline">3D printing</Link>, where its print jobs are.
        </p>
        {error ? <ErrorLine>{error}</ErrorLine> : null}
        {files.loading ? <p className="mt-2 text-sm text-secondary">Loading the files</p> : null}
        {!files.loading && missing.length ? (
          <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            Not in Files: {missing.join(", ")}. Upload {missing.length === 1 ? "it" : "them"} under that name in Files to show {missing.length === 1 ? "it" : "them"} here.
          </p>
        ) : null}
      </Panel>

      {design.renders.length ? (
        <Panel compact title="Renders" description="Rendered from the design's own model; the colours are the designer's approximation of the filaments.">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {design.renders.map((r) => {
              const f = stored.get(r.file);
              return (
                <li key={r.file} className="overflow-hidden rounded-lg border border-hairline bg-subtle">
                  {f ? (
                    <a href={`/api/files/${f.id}?inline=1`} target="_blank" rel="noreferrer" className="block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a stored file served by the app's own route, not a static asset */}
                      <img src={`/api/files/${f.id}?inline=1`} alt={r.label} loading="lazy" className="aspect-[4/3] w-full object-contain" />
                    </a>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center p-3 text-center text-sm text-secondary">{r.file} is not in Files</div>
                  )}
                  <p className="px-3 py-2 text-xs text-secondary">{r.label}</p>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <Panel compact title="Files" description="The model and the print files, as the designer exported them.">
        <ul>
          {design.model ? download(design.model, "Assembly (3MF)") : null}
          {design.printFiles.map((f) => download(f, "Print plate (3MF)"))}
          {design.documents.map((f) => download(f, "Document"))}
        </ul>
      </Panel>

      <Panel
        compact
        title="Checks"
        description={`${design.checks.length - failed.length} of ${design.checks.length} pass, as ${design.checkedBy || "its maker"} measured them. This app does not measure an authored model.`}
      >
        <ul className="grid gap-1 sm:grid-cols-2">
          {design.checks.map((c) => (
            <li key={c.label} className="text-sm">
              <span className={c.ok ? "text-success" : "text-danger"}>{c.ok ? "Pass" : "Fail"}</span> <span className="text-primary">{c.label}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
