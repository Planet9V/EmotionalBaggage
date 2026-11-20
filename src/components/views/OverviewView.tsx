"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtTime, storeHref, storeLabel } from "@/components/plan/format";
import { useConcept, type ConceptData, type ConceptPart } from "@/components/plan/useConcept";
import { CLOSED, STAGES, storeKey, type Section } from "@/lib/menu";
import { statusTone } from "@/lib/statusTones";
import { useProject } from "@/lib/client";
import type { Item, Project } from "@/lib/types";

const PARTS: ConceptPart[] = ["items", "events", "research", "challenge"];
const TROUBLE = new Set(["blocked", "wrong", "fail", "failed"]);

export function OverviewView() {
  const { project, loading } = useProject();
  if (!project) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="No concept open" />
        <div className="p-8 text-sm text-secondary">
          {loading ? (
            "Loading the concept."
          ) : (
            <p>
              There are no concepts yet. <Link href="/new" className="text-link hover:underline">Start one with the wizard</Link>.
            </p>
          )}
        </div>
      </>
    );
  }
  return <OverviewBody key={project.id} project={project} />;
}

/** Rows of a section split into open and closed, plus a line for sections whose record is not rows. */
function sectionState(section: Section, rows: Item[], data: ConceptData) {
  const closed = rows.filter((r) => CLOSED.has(r.status)).length;
  let note = "";
  if (section.view === "research") {
    const n = data.research?.entries.length ?? 0;
    note = n ? `${n} saved ${n === 1 ? "answer" : "answers"}` : "";
  } else if (section.view === "challenge") {
    const n = data.challenge?.messages.length ?? 0;
    note = n ? `${n} ${n === 1 ? "message" : "messages"}` : "";
  } else if (section.view === "model") {
    const n = data.items.filter((i) => i.section === "design/bom" && i.data.geometry).length;
    note = n ? `${n} ${n === 1 ? "part" : "parts"} with geometry` : "";
  }
  const next = rows
    .filter((r) => !CLOSED.has(r.status))
    .sort((a, b) => Number(TROUBLE.has(b.status)) - Number(TROUBLE.has(a.status)) || a.sort - b.sort || a.id - b.id)
    .slice(0, 2);
  return { total: rows.length, closed, open: rows.length - closed, note, next };
}

function OverviewBody({ project }: { project: Project }) {
  const { data, errors, loading } = useConcept(project.id, PARTS);
  const reduce = useReducedMotion();
  const byStore = new Map<string, Item[]>();
  for (const it of data.items) byStore.set(it.section, [...(byStore.get(it.section) ?? []), it]);
  const trouble = data.items.filter((i) => TROUBLE.has(i.status));
  const empty = !loading && !errors.items && data.items.length === 0;
  const failed = Object.entries(errors);

  return (
    <>
      <PageHeader eyebrow="Overview" title={project.name} blurb={project.oneLiner} />

      <div className="space-y-8 px-8 py-6">
        {failed.length > 0 && (
          <div className="rounded-xl border border-hairline bg-danger-soft p-4 text-sm text-danger" role="alert">
            {failed.map(([k, v]) => (
              <p key={k}>The {k} could not be loaded: {v}</p>
            ))}
          </div>
        )}

        {trouble.length > 0 && (
          <section aria-labelledby="blocked-h" className="rounded-xl border border-danger bg-danger-soft p-4">
            <h2 id="blocked-h" className="flex items-center gap-2 text-sm font-semibold text-danger">
              <AlertTriangle className="h-4 w-4" aria-hidden /> Blocked
              <span className="font-mono text-[11px] font-normal">{trouble.length}</span>
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {trouble.map((i) => {
                const href = storeHref(i.section);
                const inner = (
                  <>
                    <StatusBadge tone={statusTone(i.status)} className="!py-0">{i.status}</StatusBadge>
                    <span className="max-w-[22rem] truncate text-primary">{i.title}</span>
                    <span className="font-mono text-[10px] text-muted">{storeLabel(i.section)}</span>
                  </>
                );
                return (
                  <li key={i.id}>
                    {href ? (
                      <Link
                        href={href}
                        className="inline-flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-sm transition-colors duration-150 hover:border-dutchOrange/40"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-sm">{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {empty && (
          <section className="rounded-xl border border-hairline bg-surface p-6">
            <h2 className="text-base font-semibold tracking-tight text-primary">Nothing recorded yet</h2>
            <p className="mt-1 max-w-2xl text-sm text-secondary">
              Start by writing the proposition down: what it is, who it is for, and why now. Every later stage builds on it.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link
                href="/s/concept/brief"
                className="inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-2 font-medium text-white transition hover:bg-action-hover"
              >
                Concept / Brief <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
              <Link
                href="/new"
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-2 text-secondary transition-colors duration-150 hover:border-dutchOrange hover:text-link"
              >
                Or use the wizard
              </Link>
            </div>
          </section>
        )}

        {loading && !data.items.length ? (
          <p className="text-sm text-secondary">Loading the concept.</p>
        ) : (
          <ol aria-label="Stages" className="relative">
            {STAGES.map((stage, si) => {
              const last = si === STAGES.length - 1;
              return (
                <motion.li
                  key={stage.key}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut", delay: reduce ? 0 : si * 0.04 }}
                  className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 pb-8"
                >
                  {!last && <span aria-hidden className="absolute bottom-0 left-[1.25rem] top-10 w-px -translate-x-1/2 bg-hairline" />}
                  <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface font-mono text-xs text-link">
                    {String(stage.n).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 pt-1">
                    <h2 className="text-base font-semibold tracking-tight text-primary">{stage.label}</h2>
                    <p className="mt-0.5 text-sm text-secondary">{stage.goal}</p>
                    <ul className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
                      {stage.sections.map((section) => {
                        const store = storeKey(stage, section);
                        const st = sectionState(section, byStore.get(store) ?? [], data);
                        const pct = st.total ? (st.closed / st.total) * 100 : 0;
                        return (
                          <li key={section.key}>
                            <Link
                              href={`/s/${stage.key}/${section.key}`}
                              className="group grid gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-subtle md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-primary group-hover:text-link">{section.label}</p>
                                {st.total > 0 ? (
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <span
                                      className="relative h-1 w-24 overflow-hidden rounded-full bg-subtle"
                                      role="progressbar"
                                      aria-valuemin={0}
                                      aria-valuemax={st.total}
                                      aria-valuenow={st.closed}
                                      aria-label={`${section.label}: ${st.closed} of ${st.total} closed`}
                                    >
                                      <span className="absolute inset-y-0 left-0 rounded-full bg-dutchOrange" style={{ width: `${pct}%` }} />
                                    </span>
                                    <span className="font-mono text-[10px] text-muted">
                                      {st.open} open · {st.closed} closed
                                    </span>
                                  </div>
                                ) : (
                                  <p className="mt-1 font-mono text-[10px] text-muted">{st.note || "Nothing recorded"}</p>
                                )}
                                {st.total > 0 && st.note && <p className="mt-0.5 font-mono text-[10px] text-muted">{st.note}</p>}
                              </div>
                              <div className="min-w-0 md:pt-0.5">
                                {st.next.length > 0 ? (
                                  <ul className="space-y-1">
                                    {st.next.map((i) => (
                                      <li key={i.id} className="flex min-w-0 items-center gap-2 text-sm">
                                        <StatusBadge tone={statusTone(i.status)} className="!px-2 !py-0 !text-[10px]">{i.status}</StatusBadge>
                                        <span className="truncate text-secondary">{i.title}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : st.total > 0 ? (
                                  <p className="text-sm text-muted">Everything here is closed.</p>
                                ) : (
                                  <p className="text-sm text-muted">{section.blurb}</p>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}

        <section aria-labelledby="activity-h">
          <h2 id="activity-h" className="text-base font-semibold tracking-tight text-primary">Recent activity</h2>
          {data.events.length ? (
            <ul className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
              {data.events.slice(0, 8).map((e) => (
                <li key={e.id} className="grid gap-x-4 px-4 py-2.5 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_auto]">
                  <span className="font-mono text-[11px] text-muted">{fmtTime(e.createdAt)}</span>
                  <span className="text-secondary">{e.summary}</span>
                  <span className="font-mono text-[10px] text-muted">{e.kind}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">{loading ? "Loading." : "No activity recorded yet."}</p>
          )}
        </section>
      </div>
    </>
  );
}
