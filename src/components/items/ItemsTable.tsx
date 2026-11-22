"use client";

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortFn,
} from "@tanstack/react-table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/Card";
import { SortHead, ColumnsMenu, focusNeighbour } from "@/components/ui/data-table";
import { statusTone } from "@/lib/statusTones";
import type { Column } from "@/lib/menu";
import type { Item } from "@/lib/types";
import { prim } from "./shared";
import { RowActions } from "@/components/drafts/RowActions";

type Props = {
  items: Item[];
  statuses: string[];
  columns: Column[];
  onOpen: (id: number) => void;
  onStatus: (id: number, status: string) => void | Promise<void>;
  /** one more column after the data columns, for sections that show more than columns (requirements show their coverage) */
  extraColumn?: { label: string; render: (item: Item) => ReactNode };
};

const num = (s: string) => {
  const n = Number(s.replace(/[$,\s%]/g, ""));
  return s.trim() !== "" && Number.isFinite(n) ? n : null;
};

/** Ascending order of two cell texts: numbers by value (with $, % and commas read), the rest by words with embedded numbers in order. */
const compareText = (x: string, y: string) => {
  const nx = num(x);
  const ny = num(y);
  return nx !== null && ny !== null ? nx - ny : x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
};

const features = tableFeatures({ rowSortingFeature, columnVisibilityFeature, sortedRowModel: createSortedRowModel() });
const text: SortFn<typeof features, Item> = (a, b, id) => compareText(String(a.getValue(id) ?? ""), String(b.getValue(id) ?? ""));
const helper = createColumnHelper<typeof features, Item>();
const EMPTY: Item[] = [];

/**
 * The list pattern's table, on TanStack Table: sortable headers (aria-sort, a third click clears the sort),
 * a Columns menu to hide any column, and arrow-key movement between rows (Up and Down move to the same
 * control in the next or previous row; Home and End go to the first or last row). Rows keep the section's own order until a sort is chosen.
 */
export function ItemsTable({ items, statuses, columns, onOpen, onStatus, extraColumn }: Props) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const defs = useMemo(
    () =>
      helper.columns([
        helper.accessor((it) => it.title, { id: "title", header: "Title", sortFn: text, cell: (c) => c.getValue() }),
        ...columns.map((col) => helper.accessor((it) => prim(it.data[col.key]), { id: `d:${col.key}`, header: col.label, sortFn: text })),
        ...(extraColumn ? [helper.display({ id: "extra", header: extraColumn.label, enableSorting: false, enableHiding: true })] : []),
        helper.accessor((it) => String(statuses.indexOf(it.status)).padStart(4, "0"), { id: "status", header: "Status", sortFn: text }),
        helper.display({ id: "actions", header: "Actions", enableSorting: false, enableHiding: false }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, statuses, extraColumn?.label],
  );

  const ordered = useMemo(() => [...items].sort((a, b) => a.sort - b.sort), [items]);
  const table = useTable({
    features,
    columns: defs,
    data: ordered ?? EMPTY,
    getRowId: (it) => String(it.id),
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: (u) => setVisibility((v) => (typeof u === "function" ? u(v) : u)),
    enableSortingRemoval: true,
    enableMultiSort: false,
  });

  const onKey = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    if (e.target instanceof HTMLSelectElement) return; // arrows change a select's value
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
      if (focusNeighbour(e.currentTarget, e.target as HTMLElement, e.key)) e.preventDefault();
    }
  };

  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ColumnsMenu
          columns={hideable.map((c) => ({ id: c.id, label: typeof c.columnDef.header === "string" ? c.columnDef.header : c.id, visible: c.getIsVisible(), toggle: (v) => c.toggleVisibility(v) }))}
        />
      </div>
      <Card variant="flat" className="overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((g) => (
              <TableRow key={g.id} className="hover:bg-transparent">
                {g.headers.map((h) => (
                  <SortHead
                    key={h.id}
                    label={String(h.column.columnDef.header)}
                    sortable={h.column.getCanSort()}
                    sorted={h.column.getIsSorted() || false}
                    onToggle={() => h.column.toggleSorting(h.column.getIsSorted() === "asc", false)}
                    onClear={() => h.column.clearSorting()}
                    hiddenLabel={h.column.id === "actions"}
                  />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody onKeyDown={onKey}>
            {table.getRowModel().rows.map((row, i) => {
              const it = row.original;
              const visible = new Set(row.getVisibleCells().map((c) => c.column.id));
              return (
                <tr data-row className="animate-enter border-b border-hairline transition-colors hover:bg-subtle" style={{ animationDelay: `${Math.min(i * 0.025, 0.25) * 1000}ms` }} key={row.id}>
                  {visible.has("title") && (
                    <TableCell className="max-w-88 font-medium text-primary">
                      <button type="button" data-nav="title" data-row-id={it.id} onClick={() => onOpen(it.id)} className="text-left wrap-anywhere hover:text-link focus-visible:outline-hidden focus-visible:underline">
                        {it.title}
                      </button>
                    </TableCell>
                  )}
                  {columns.map((c) => visible.has(`d:${c.key}`) && (
                    <TableCell key={c.key} className="max-w-[16rem] truncate font-mono text-xs" title={prim(it.data[c.key])}>
                      {prim(it.data[c.key]) || <span className="text-muted">-</span>}
                    </TableCell>
                  ))}
                  {extraColumn && visible.has("extra") && <TableCell>{extraColumn.render(it)}</TableCell>}
                  {visible.has("status") && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge tone={statusTone(it.status)}>{it.status}</StatusBadge>
                        <NativeSelect value={it.status} onChange={(e) => void onStatus(it.id, e.target.value)} aria-label={`Status of ${it.title}`} className="h-8 w-28 text-xs">
                          {statuses.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1">
                    <RowActions item={it} />
                    <button
                      type="button"
                      data-nav="open"
                      onClick={() => onOpen(it.id)}
                      className="rounded-md px-2 py-1 text-xs text-secondary hover:text-link focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
                      aria-label={`Open ${it.title}`}
                    >
                      Open
                    </button>
                    </span>
                  </TableCell>
                </tr>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
