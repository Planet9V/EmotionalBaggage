"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorLine } from "@/components/parts/controls";
import { api } from "@/lib/client";

type Integration = { key: string; name: string; purpose: string; env: string[]; configured: boolean; built: "yes" | "partial" | "no"; note: string };
type Report = {
  integrations: Integration[];
  database: { connected: boolean; vector: boolean; version?: string };
  planner: { connected: boolean; networkx?: string; error?: string; reason?: string; note?: string };
};

const BUILT: Record<Integration["built"], { label: string; tone: "success" | "warning" | "neutral" }> = {
  yes: { label: "Built", tone: "success" },
  partial: { label: "Partly built", tone: "warning" },
  no: { label: "Not built yet", tone: "neutral" },
};

export function IntegrationsView() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const reduce = useReducedMotion();

  useEffect(() => {
    let alive = true;
    api<Report>("/api/integrations")
      .then((r) => { if (alive) setData(r); })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const plannerWhy = data?.planner.error ?? data?.planner.reason ?? data?.planner.note;

  return (
    <>
      <PageHeader eyebrow="Settings" title="Integrations" blurb="What is connected, what is built, and which values each one needs." />
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
                  Semantic search needs pgvector plus an embedding provider. It currently falls back to text search.
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
                  <p className="mt-3 text-sm text-secondary">{plannerWhy ? plannerWhy : "The planner service did not answer. The plan page uses its built-in fallback until it does."}</p>
                )}
              </div>
            </section>

            <section aria-labelledby="int-h" className="space-y-3">
              <h2 id="int-h" className="text-base font-semibold tracking-tight text-primary">Integrations</h2>
              <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[12rem]">Integration</TableHead>
                      <TableHead>Connected</TableHead>
                      <TableHead>Built</TableHead>
                      <TableHead className="min-w-[12rem]">Environment variables</TableHead>
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
                        <TableCell className="align-top font-mono text-xs text-primary">
                          {i.env.length ? i.env.map((e) => <div key={e}>{e}</div>) : <span className="font-sans text-muted">None needed</span>}
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
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-secondary">
                <li>Open the <span className="font-mono text-xs text-primary">.env</span> file next to <span className="font-mono text-xs text-primary">docker-compose.yml</span>.</li>
                <li>Add the values the integration needs, one <span className="font-mono text-xs text-primary">NAME=value</span> per line.</li>
                <li>Restart the stack so the app reads the new values.</li>
              </ol>
              <p className="mt-2 text-sm text-secondary">An integration shows as connected only when all of its values are set. That does not mean it works: check the Built column.</p>
            </section>
          </>
        )}
      </motion.div>
    </>
  );
}
