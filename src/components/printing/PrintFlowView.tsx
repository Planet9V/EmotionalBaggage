"use client";

import Link from "next/link";
import { PrintersPanel } from "@/components/printers/PrintersPanel";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorLine } from "@/components/parts/controls";
import { Modal } from "@/components/parts/Modal";
import { toPart } from "@/lib/domain";
import { useItems } from "@/lib/client";
import { keys, messageOf, queries } from "@/lib/queries";
import { usePrinters } from "@/lib/admin/client";
import { keyOf } from "@/lib/trace/spec";
import { useSlicer } from "@/lib/slicing/queries";
import { normaliseStatus } from "@/lib/slicing/jobState";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { JobCard } from "./JobCard";
import { NewJobDialog } from "./NewJobDialog";

const NO_FILES: never[] = [];

export function PrintFlowView({ project, store }: ViewProps) {
  const reduce = useReducedMotion();
  const jobs = useItems(project.id, store);
  const bom = useItems(project.id, "design/bom");
  const builds = useItems(project.id, "prototype/builds");
  const slicer = useSlicer();
  const printers = usePrinters();
  const filesQ = useQuery(queries.files(project.id));
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [actionError, setActionError] = useState("");

  const parts = useMemo(() => bom.items.map(toPart).filter((p) => p.geometry?.print === true || p.item.status === "to print").map((p) => ({ ref: p.ref, title: p.item.title })), [bom.items]);
  const buildOpts = useMemo(() => builds.items.map((b) => ({ key: keyOf(b.data), title: b.title })).filter((b) => b.key), [builds.items]);
  const buildTitle = (j: Item) => buildOpts.find((b) => b.key === (j.data as { buildKey?: string }).buildKey)?.title;

  const s = slicer.data;
  const files = filesQ.data ?? NO_FILES;
  const anySlicing = jobs.items.some((j) => normaliseStatus(j.status) === "slicing");

  const qc = useQueryClient();
  useEffect(() => {
    if (!anySlicing) return;
    const t = setInterval(() => void qc.invalidateQueries({ queryKey: keys.itemsOf(project.id) }), 5000);
    return () => clearInterval(t);
  }, [anySlicing, qc, project.id]);

  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
      <PrintersPanel />
      <section aria-labelledby="slicer-h" className="rounded-xl border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="slicer-h" className="text-base font-semibold tracking-tight text-primary">Slicer</h2>
          {slicer.isLoading ? <StatusBadge tone="neutral">Checking</StatusBadge> : s?.ok ? <StatusBadge tone="success">Ready</StatusBadge> : s?.configured ? <StatusBadge tone="danger">Not reachable</StatusBadge> : <StatusBadge tone="neutral">Not set up</StatusBadge>}
        </div>
        <div className="mt-2 text-sm text-secondary" aria-live="polite">
          {slicer.isError ? (
            <div className="space-y-2"><ErrorLine>{messageOf(slicer.error)}</ErrorLine><Button size="sm" variant="outline" onClick={() => void slicer.refetch()}>Try again</Button></div>
          ) : slicer.isLoading ? (
            <p>Asking the slicer service.</p>
          ) : !s?.configured ? (
            <p>
              No slicer service is set up, so jobs cannot be sliced here. Start it with <span className="font-mono text-primary">docker compose --profile slicer up -d slicer</span> and save its address (<span className="font-mono text-primary">http://slicer:8000</span>) in <Link className="text-link underline" href="/admin?tab=printers">Admin, Printers</Link>; the SLICER_URL environment variable is the fallback. You can still queue jobs.
            </p>
          ) : !s.ok ? (
            <div className="space-y-2"><ErrorLine>{s.message}</ErrorLine><Button size="sm" variant="outline" onClick={() => void slicer.refetch()}>Check again</Button></div>
          ) : (
            <p>OrcaSlicer {s.orca?.version} runs as its own service. Time and filament below come from its output, not from an estimate.</p>
          )}
        </div>
      </section>

      {actionError || jobs.writeError ? <ErrorLine>{actionError || jobs.writeError}</ErrorLine> : null}

      <section aria-labelledby="jobs-h" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="jobs-h" className="text-base font-semibold tracking-tight text-primary">Print jobs</h2>
          <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> New print job</Button>
        </div>
        {jobs.error ? <div className="space-y-2"><ErrorLine>{jobs.error}</ErrorLine></div> : null}
        {printers.isError ? <ErrorLine>The printer list did not load: {messageOf(printers.error)}</ErrorLine> : null}
        {filesQ.isError ? <ErrorLine>The stored files did not load: {messageOf(filesQ.error)}</ErrorLine> : null}
        {jobs.loading ? (
          <p className="text-sm text-secondary">Loading the jobs.</p>
        ) : !jobs.items.length ? (
          <EmptyState title="No print jobs yet">Pick a stored STL or the enclosure, a printer from Admin and a material, then slice it. Printers are set up in Admin, Printers.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {jobs.items.map((j) => (
              <JobCard key={j.id} projectId={project.id} job={j} buildTitle={buildTitle(j)} onDelete={() => setDel(j)} onEdit={() => setEditing(j)} onRequeue={() => jobs.patch(j.id, { status: "queued" })} />
            ))}
          </ul>
        )}
        {anySlicing ? <p role="status" className="text-xs text-muted">A job is being sliced. The list refreshes on its own.</p> : null}
      </section>

      <NewJobDialog
        open={adding}
        onOpenChange={setAdding}
        files={files}
        parts={parts}
        builds={buildOpts}
        printers={printers.data ?? []}
        slicer={s}
        onCreate={async (v) => { await jobs.add({ section: store, title: v.title, status: "queued", data: v.data }); }}
      />
      {editing ? (
        <NewJobDialog
          key={editing.id}
          open
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          editing={editing}
          files={files}
          parts={parts}
          builds={buildOpts}
          printers={printers.data ?? []}
          slicer={s}
          onCreate={async (v) => { await jobs.patch(editing.id, { title: v.title, data: v.data }); }}
        />
      ) : null}
      <Modal open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this print job?" description="The stored files, including any sliced G-code, are kept.">
        <p className="text-sm font-medium text-primary">{del?.title}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDel(null)}>Keep it</Button>
          <Button onClick={async () => {
            if (!del) return;
            try { setActionError(""); await jobs.remove(del.id); } catch (e) { setActionError((e as Error).message); }
            setDel(null);
          }}>Delete job</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
