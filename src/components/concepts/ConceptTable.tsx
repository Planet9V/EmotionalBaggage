"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, Copy, Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportHref, lastChanged, type Concept } from "@/lib/conceptsClient";
import { stageLabel, typeLabel } from "./model";
import { fmtDateTime, plural } from "@/lib/format";

type ActionKind = "edit" | "delete" | "duplicate" | "archive";

/** One group of concepts (active or archived) as a table. Each row: Open (or Restore) and a menu of the rest. */
export function ConceptTable({
  concepts,
  label,
  currentId,
  busyId,
  onOpen,
  onAction,
  onRestore,
}: {
  concepts: Concept[];
  label: string;
  currentId: string;
  busyId?: string;
  onOpen: (c: Concept) => void;
  onAction: (a: { kind: ActionKind; id: string; concept: Concept }) => void;
  onRestore: (c: Concept) => void;
}) {
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead className="hidden lg:table-cell">Product type</TableHead>
          <TableHead className="hidden lg:table-cell">Stage</TableHead>
          <TableHead className="hidden lg:table-cell">Last changed</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Rows</TableHead>
          <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {concepts.map((c) => (
          <Row key={c.id} c={c} current={c.id === currentId} busy={busyId === c.id} onOpen={onOpen} onAction={onAction} onRestore={onRestore} />
        ))}
      </TableBody>
    </Table>
  );
}

function Row({
  c,
  current,
  busy,
  onOpen,
  onAction,
  onRestore,
}: {
  c: Concept;
  current: boolean;
  busy: boolean;
  onOpen: (c: Concept) => void;
  onAction: (a: { kind: ActionKind; id: string; concept: Concept }) => void;
  onRestore: (c: Concept) => void;
}) {
  const archived = !!c.archivedAt;
  const changed = lastChanged(c);
  const act = (kind: ActionKind) => () => onAction({ kind, id: c.id, concept: c });
  return (
    <TableRow data-concept={c.id}>
      <TableCell className="w-full max-w-0 min-w-[10rem] py-3">
        <p className="flex items-center gap-2 truncate font-medium text-primary">
          <span className="truncate">{c.name}</span>
          {current && (
            <span className="shrink-0 rounded-full border border-dutchOrange px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-link">
              Open now
            </span>
          )}
        </p>
        <p className="truncate text-xs text-secondary">{c.oneLiner || <span className="text-muted">No description</span>}</p>
        {/* Below 1024 px the other columns fold into this line, so the name keeps its width. */}
        <p className="mt-0.5 whitespace-normal font-mono text-[10px] text-muted lg:hidden">
          {typeLabel(c.productType)} · {stageLabel(c.stage)} · {fmtDateTime(changed)} · {plural(c.rowCount, "row")}
        </p>
      </TableCell>
      <TableCell className="hidden whitespace-nowrap lg:table-cell">{typeLabel(c.productType)}</TableCell>
      <TableCell className="hidden whitespace-nowrap lg:table-cell">{stageLabel(c.stage)}</TableCell>
      <TableCell className="hidden whitespace-nowrap font-mono text-xs lg:table-cell">
        <time dateTime={changed}>{fmtDateTime(changed)}</time>
      </TableCell>
      <TableCell className="hidden text-right font-mono text-xs lg:table-cell">{c.rowCount.toLocaleString()}</TableCell>
      <TableCell className="whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1.5">
          {archived ? (
            <Button variant="outline" size="sm" onClick={() => onRestore(c)} disabled={busy} aria-busy={busy}>
              {busy ? "Restoring..." : "Restore"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/?concept=${encodeURIComponent(c.id)}`} onClick={() => onOpen(c)} aria-label={`Open ${c.name}`}>
                Open
              </Link>
            </Button>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" data-row-menu={c.id} aria-label={`More actions for ${c.name}`}>
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!archived && (
                <DropdownMenuItem onSelect={act("edit")}>
                  <Pencil aria-hidden /> Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={act("duplicate")}>
                <Copy aria-hidden /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={exportHref(c.id)} download>
                  <Download aria-hidden /> Export as JSON
                </a>
              </DropdownMenuItem>
              {archived ? (
                <DropdownMenuItem onSelect={() => onRestore(c)}>
                  <ArchiveRestore aria-hidden /> Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={act("archive")}>
                  <Archive aria-hidden /> Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={act("delete")}>
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
