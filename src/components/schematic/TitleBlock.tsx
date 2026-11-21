"use client";

import { NativeSelect } from "@/components/ui/native-select";
/** The schematic's title block: concept, revision and date. Shown on the canvas and on the printed sheet. */
export function TitleBlock({ concept, revision, revisions, onRevision, date, view }: { concept: string; revision: string; revisions: string[]; onRevision: (r: string) => void; date: string; view: string }) {
  return (
    <div className="w-[300px] border border-[var(--text-primary)] bg-surface font-sans text-primary" data-testid="title-block">
      <div className="border-b border-[var(--text-primary)] px-3 py-1.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Concept</p>
        <p className="truncate text-sm font-semibold" title={concept}>
          {concept}
        </p>
      </div>
      <div className="grid grid-cols-[1fr_1fr]">
        <div className="border-r border-[var(--text-primary)] px-3 py-1.5">
          <label className="block font-mono text-[9px] uppercase tracking-[0.18em] text-muted" htmlFor="schematic-revision">
            Revision
          </label>
          {revisions.length > 1 ? (
            <>
              <NativeSelect
                id="schematic-revision"
                value={revision}
                onChange={(e) => onRevision(e.target.value)}
                className="schematic-noprint mt-0.5 h-auto truncate rounded-sm px-1 py-0.5 text-xs"
              >
                {revisions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
              <span className="schematic-printonly hidden text-xs">{revision}</span>
            </>
          ) : (
            <p id="schematic-revision" className="truncate text-xs">
              {revision}
            </p>
          )}
        </div>
        <div className="px-3 py-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Date</p>
          <p className="font-mono text-xs">{date}</p>
        </div>
      </div>
      <div className="border-t border-[var(--text-primary)] px-3 py-1 text-[10px] text-secondary">{view}</div>
    </div>
  );
}
