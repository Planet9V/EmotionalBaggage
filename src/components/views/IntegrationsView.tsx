"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorLine } from "@/components/parts/controls";
import { messageOf, queries, type Integration } from "@/lib/queries";


const ADMIN_TAB = { credentials: "credentials", settings: "models", printers: "printers" } as const;
const ADMIN_LABEL = { credentials: "Credentials", settings: "Models", printers: "Printers" } as const;

const BUILT: Record<Integration["built"], { label: string; tone: "success" | "warning" | "neutral" }> = {
  yes: { label: "Built", tone: "success" },
  partial: { label: "Partly built", tone: "warning" },
  no: { label: "Not built yet", tone: "neutral" },
};

export function IntegrationsView() {
  const report = useQuery(queries.integrations());
  const data = report.data ?? null;
  const error = messageOf(report.error);
  const reduce = useReducedMotion();

  const plannerWhy = data?.planner.error ?? data?.planner.reason ?? data?.planner.note;

  return (
    <>
      <PageHeader eyebrow="Settings" title="Integrations" blurb="What is connected, what is built, and where in Admin each one is set." />
      <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-8 px-8 py-6">
        {error ? <ErrorLine>{error}</ErrorLine> : null}
        {!data && !error ? <p className="text-sm text-secondary">Reading the integrations.</p> : null}

        {data && (
          <>
            <section aria-label="Services" className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-hairline bg-surface p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold tracking-tight text-primary">Database</h2>
                  <StatusBadge tone={data.database.connected ? "success" : "danger"}>{data.database.connected ? "Connected" : "Not connected"}</StatusBadge>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex gap-2"><dt className="w-24 text-muted">Version</dt><dd className="font-mono text-xs text-primary">{data.database.version ?? "unknown"}</dd></div>
                  <div className="flex gap-2"><dt className="w-24 text-muted">pgvector</dt><dd className="text-primary">{data.database.vector ? "Available" : "Not available"}</dd></div>
                </dl>
                <p className="mt-3 text-sm text-secondary">
                  {data.database.vector
                    ? "Search by meaning also needs an embedding model, chosen in Admin, Models. Without one, search matches words."
                    : "Search by meaning needs pgvector in the database, which this one does not have. Search matches words."}
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-surface p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold tracking-tight text-primary">Planner</h2>
                  <StatusBadge tone={data.planner.connected ? "success" : "warning"}>{data.planner.connected ? "Connected" : "Unreachable"}</StatusBadge>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex gap-2"><dt className="w-24 text-muted">NetworkX</dt><dd className="font-mono text-xs text-primary">{data.planner.connected ? data.planner.networkx ?? "unknown" : "not reachable"}</dd></div>
                </dl>
                {!data.planner.connected && (
                  <p className="mt-3 text-sm text-secondary">{plannerWhy ? plannerWhy : "The planner service did not answer. The order of operations cannot be worked out until it does; the plan page lists the steps without an order."}</p>
                )}
              </div>
            </section>

            <section aria-labelledby="int-h" className="space-y-3">
              <h2 id="int-h" className="text-base font-semibold tracking-tight text-primary">Integrations</h2>
              <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-48">Integration</TableHead>
                      <TableHead>Connected</TableHead>
                      <TableHead>Built</TableHead>
                      <TableHead className="min-w-48">Where to set it</TableHead>
                      <TableHead className="min-w-[18rem]">Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.integrations.map((i) => (
                      <TableRow key={i.key} className="align-top">
                        <TableCell className="align-top">
                          <p className="font-medium text-primary">{i.name}</p>
                          <p className="mt-0.5 text-xs text-secondary">{i.purpose}</p>
                        </TableCell>
                        <TableCell className="align-top"><StatusBadge tone={i.configured ? "success" : "neutral"}>{i.configured ? "Connected" : "Not connected"}</StatusBadge></TableCell>
                        <TableCell className="align-top"><StatusBadge tone={BUILT[i.built].tone}>{BUILT[i.built].label}</StatusBadge></TableCell>
                        <TableCell className="align-top text-xs">
                          {i.admin ? (
                            <Link href={`/admin?tab=${ADMIN_TAB[i.admin]}`} className="text-link underline-offset-4 hover:underline">
                              Admin, {ADMIN_LABEL[i.admin]}
                            </Link>
                          ) : (
                            <span className="text-muted">Nothing to set</span>
                          )}
                          {i.env.length ? (
                            <p className="mt-1 text-muted">
                              Fallback: <span className="font-mono text-primary">{i.env.join(", ")}</span>
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top text-xs">{i.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section aria-labelledby="how-h" className="max-w-3xl rounded-xl border border-hairline bg-subtle p-5">
              <h2 id="how-h" className="text-base font-semibold tracking-tight text-primary">How to connect</h2>
              <p className="mt-2 text-sm text-secondary">
                Configure everything in <Link href="/admin" className="text-link underline-offset-4 hover:underline">Admin</Link>: models in Models, keys in Credentials, printers in Printers. Each has a Test button, and what you save is kept in this install&apos;s database. No restart is needed.
              </p>
              <p className="mt-2 text-sm text-secondary">
                The environment variables listed above are fallbacks only. They apply when Admin has nothing saved for the same value, so an install set up through <span className="font-mono text-xs text-primary">.env</span> keeps working.
              </p>
              <p className="mt-2 text-sm text-secondary">An integration shows as connected only when all of its values are set. That does not mean it works: check the Built column, or use Test in Admin.</p>
            </section>
          </>
        )}
      </motion.div>
    </>
  );
}
