"use client";

// Small parts shared by the tables built on TanStack Table: a sortable header cell, a Columns menu, and
// arrow-key movement between rows. The table state itself lives in the table (see items/ItemsTable.tsx).
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TableHead } from "@/components/ui/table";

/** A header cell. A sortable one is a button that cycles ascending, descending, none. */
export function SortHead({
  label,
  sortable,
  sorted,
  onToggle,
  onClear,
  hiddenLabel,
}: {
  label: string;
  sortable: boolean;
  sorted: false | "asc" | "desc";
  onToggle: () => void;
  onClear: () => void;
  hiddenLabel?: boolean;
}) {
  if (!sortable) {
    return <TableHead>{hiddenLabel ? <span className="sr-only">{label}</span> : label}</TableHead>;
  }
  const Icon = !sorted ? ChevronsUpDown : sorted === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}>
      <button
        type="button"
        onClick={() => (sorted === "desc" ? onClear() : onToggle())}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.15em] hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${sorted ? "text-primary" : ""}`}
      >
        {label}
        <Icon className="h-3 w-3" aria-hidden />
      </button>
    </TableHead>
  );
}

/** Show or hide columns. */
export function ColumnsMenu({ columns }: { columns: { id: string; label: string; visible: boolean; toggle: (visible: boolean) => void }[] }) {
  if (columns.length < 2) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="h-3.5 w-3.5" aria-hidden /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        {columns.map((c) => (
          <DropdownMenuCheckboxItem key={c.id} checked={c.visible} onCheckedChange={(v) => c.toggle(!!v)} onSelect={(e) => e.preventDefault()}>
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Moves focus to the same control (data-nav) in the next or previous row of `body`, or to the first or
 * last row for Home and End. Rows are the elements marked `data-row`. Answers whether focus moved.
 */
export function focusNeighbour(body: HTMLElement, from: HTMLElement, key: string): boolean {
  const rows = Array.from(body.querySelectorAll<HTMLElement>("[data-row]"));
  const row = from.closest<HTMLElement>("[data-row]");
  if (!row) return false;
  const at = rows.indexOf(row);
  const to = key === "ArrowDown" ? at + 1 : key === "ArrowUp" ? at - 1 : key === "Home" ? 0 : rows.length - 1;
  const target = rows[to];
  if (!target || to === at) return false;
  const nav = from.closest<HTMLElement>("[data-nav]")?.dataset.nav ?? from.dataset.nav;
  const next = (nav ? target.querySelector<HTMLElement>(`[data-nav="${nav}"]`) : null) ?? target.querySelector<HTMLElement>("button, select");
  next?.focus();
  return !!next;
}
