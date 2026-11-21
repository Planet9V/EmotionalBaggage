"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useItems, useProject } from "@/lib/client";
import { statusTone } from "@/lib/statusTones";
import { traceOf } from "@/lib/trace/coverage";
import type { Item, Project } from "@/lib/types";
import { Coverage } from "./Coverage";
import { DraftLinks } from "./DraftLinks";
import { NoConcept, LoadingShape } from "@/components/ui/states";
import { Card } from "@/components/ui/Card";

export function TraceabilityView() {
  const { project, loading } = useProject();
  return (
    <>
      <PageHeader
        eyebrow={`Tools${project ? ` · ${project.name}` : ""}`}
        title="Traceability"
        blurb="Which test checks which requirement, and which parts a requirement needs. Link them in the requirement's editor."
      />
      <div className="px-8 py-6">
        {!project ? (
          <NoConcept loading={loading} />
        ) : (
          <TraceBody key={project.id} project={project} />
        )}
      </div>
    </>
  );
}

function Gap({ title, empty, rows, href, label }: { title: string; empty: string; rows: Item[]; href: string; label: (i: Item) => string }) {
  return (
    <Card variant="flat" as="section" aria-label={title} className="p-4">
      <h2 className="text-sm font-semibold tracking-tight text-primary">{title}</h2>
      {rows.length ? (
        <ul className="mt-2 space-y-1">
          {rows.map((r) => (
            <li key={r.id} className="text-sm">
              <Link href={href} className="text-secondary hover:text-link wrap-anywhere">
                {label(r)}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-secondary">{empty}</p>
      )}
    </Card>
  );
}

function TraceBody({ project }: { project: Project }) {
  const { items, loading, error, reload } = useItems(project.id, null);
  const t = useMemo(() => traceOf(items), [items]);

  if (loading) {
    return (
      <LoadingShape className="space-y-3" label="Loading traceability">
        <div className="h-48 animate-pulse rounded-xl bg-subtle" />
        <div className="h-24 animate-pulse rounded-xl bg-subtle" />
      </LoadingShape>
    );
  }
  if (error && !items.length) {
    return (
      <div role="alert" className="max-w-xl rounded-xl border border-hairline bg-danger-soft p-4">
        <p className="text-sm font-medium text-danger">The rows could not be loaded.</p>
        <p className="mt-1 text-sm text-danger wrap-anywhere">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!t.requirements.length) {
    return (
      <div className="max-w-xl rounded-xl border border-dashed border-hairline bg-surface p-8 text-center">
        <p className="text-lg font-semibold tracking-tight text-primary">No requirements yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-secondary">Add requirements in Design, then link each to the tests that check it and the parts it needs.</p>
        <Link href="/s/design/requirements" className="mt-4 inline-block text-sm text-link hover:underline">
          Go to Requirements
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DraftLinks projectId={project.id} gaps={t.untested.length + t.orphanTests.length + t.unusedParts.length} />
      <section aria-label="Requirements by test">
        <h2 className="mb-2 text-sm font-semibold tracking-tight text-primary">Requirements by test</h2>
        {t.tests.length ? (
          <Card variant="flat" className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-56">Requirement</TableHead>
                  {t.tests.map((x) => (
                    <TableHead key={x.id} className="min-w-28 align-bottom">
                      <span className="block font-sans text-xs font-medium normal-case tracking-normal text-primary wrap-anywhere">{x.title}</span>
                      <StatusBadge tone={statusTone(x.status)} className="mt-1">
                        {x.status}
                      </StatusBadge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.requirements.map((r) => {
                  const linked = new Set(t.testsOf(r).map((x) => x.id));
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-primary">
                        <Link href="/s/design/requirements" className="hover:text-link wrap-anywhere">
                          {r.title}
                        </Link>
                        <div className="mt-0.5">
                          <Coverage item={r} />
                        </div>
                      </TableCell>
                      {t.tests.map((x) => {
                        const on = linked.has(x.id);
                        return (
                          <TableCell key={x.id} className="text-center">
                            {on ? (
                              <span className="inline-flex" role="img" aria-label={`${x.title} checks ${r.title}`}>
                                <Check className="h-4 w-4 text-link" aria-hidden />
                              </span>
                            ) : (
                              <span className="sr-only">not linked</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <p className="text-sm text-secondary">
            There are no acceptance tests yet. <Link href="/s/prototype/tests" className="text-link hover:underline">Add tests</Link> to cover the requirements.
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Gap
          title={`Requirements with no test${t.untested.length ? ` (${t.untested.length})` : ""}`}
          empty="Every requirement has at least one test."
          rows={t.untested}
          href="/s/design/requirements"
          label={(r) => r.title}
        />
        <Gap
          title={`Tests that check no requirement${t.orphanTests.length ? ` (${t.orphanTests.length})` : ""}`}
          empty="Every test checks a requirement."
          rows={t.orphanTests}
          href="/s/prototype/tests"
          label={(r) => r.title}
        />
        <Gap
          title={`Parts no requirement needs${t.unusedParts.length ? ` (${t.unusedParts.length})` : ""}`}
          empty="Every part is needed by a requirement."
          rows={t.unusedParts}
          href="/s/design/bom"
          label={(r) => (typeof r.data.ref === "string" && r.data.ref ? `${r.data.ref} ${r.title}` : r.title)}
        />
      </div>
    </div>
  );
}
