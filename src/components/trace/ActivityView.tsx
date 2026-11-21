"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/items/shared";
import { STAGES, storeKey } from "@/lib/menu";
import { useProject } from "@/lib/client";
import { useActivity } from "@/lib/trace/client";
import type { Project } from "@/lib/types";
import { HistoryEntryView } from "./HistoryEntryView";
import { NativeSelect } from "@/components/ui/native-select";
import { NoConcept } from "@/components/ui/states";

const KINDS = [
  ["item", "Rows added, edited or removed"],
  ["claim", "Evidence on claims"],
  ["file", "Files"],
  ["research", "Research"],
  ["chat", "Chats"],
  ["project", "The concept itself"],
] as const;

const SECTIONS = STAGES.flatMap((st) => st.sections.map((s) => ({ store: storeKey(st, s), label: `${st.label}: ${s.label}` })))
  // Several sections show one store (the parts list); the filter is by store, so each store is listed once.
  .filter((s, i, all) => all.findIndex((x) => x.store === s.store) === i);

export function ActivityView() {
  const { project, loading } = useProject();
  return (
    <>
      <PageHeader eyebrow={`Tools${project ? ` · ${project.name}` : ""}`} title="Activity" blurb="Every change to this concept: who made it, when, and each field before and after." />
      <div className="px-8 py-6">
        {!project ? (
          <NoConcept loading={loading} />
        ) : (
          <ActivityBody key={project.id} project={project} />
        )}
      </div>
    </>
  );
}

function ActivityBody({ project }: { project: Project }) {
  const [section, setSection] = useState("");
  const [kind, setKind] = useState("");
  const a = useActivity(project.id, section, kind);
  const filtering = section !== "" || kind !== "";

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <Field label="Section" htmlFor="activity-section">
            <NativeSelect id="activity-section" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">All sections</option>
              {SECTIONS.map((s) => (
                <option key={s.store} value={s.store}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="w-full sm:w-64">
          <Field label="Kind of change" htmlFor="activity-kind">
            <NativeSelect id="activity-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All changes</option>
              {KINDS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {filtering && (
          <Button variant="ghost" size="sm" onClick={() => { setSection(""); setKind(""); }}>
            Clear filters
          </Button>
        )}
      </div>

      {a.loading ? (
        <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading activity">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-subtle" />
          ))}
        </div>
      ) : a.error && !a.entries.length ? (
        <div role="alert" className="rounded-xl border border-hairline bg-danger-soft p-4">
          <p className="text-sm font-medium text-danger">The activity could not be loaded.</p>
          <p className="mt-1 text-sm text-danger wrap-anywhere">{a.error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={a.reload}>
            Try again
          </Button>
        </div>
      ) : !a.entries.length ? (
        <div className="rounded-xl border border-dashed border-hairline p-6 text-center">
          <p className="text-sm text-secondary">{filtering ? "No changes match these filters." : "Nothing has changed in this concept yet."}</p>
        </div>
      ) : (
        <>
          <ol className="space-y-2" aria-label="Changes, newest first">
            {a.entries.map((e) => (
              <HistoryEntryView key={e.id} entry={e} showRow />
            ))}
          </ol>
          {a.error && (
            <p role="alert" className="text-sm text-danger">
              {a.error}
            </p>
          )}
          {a.more && (
            <Button variant="outline" onClick={a.loadMore} disabled={a.loadingMore}>
              {a.loadingMore ? "Loading" : "Load more"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
