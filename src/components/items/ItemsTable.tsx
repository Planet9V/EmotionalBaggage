"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { statusTone } from "@/lib/statusTones";
import type { Column } from "@/lib/menu";
import type { Item } from "@/lib/types";
import { prim } from "./shared";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/Card";

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

export function ItemsTable({ items, statuses, columns, onOpen, onStatus, extraColumn }: Props) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const value = (it: Item, key: string) => (key === "title" ? it.title : key === "status" ? String(statuses.indexOf(it.status)).padStart(4, "0") : prim(it.data[key]));
  const rows = useMemo(() => {
    if (!sort) return [...items].sort((a, b) => a.sort - b.sort);
    return [...items].sort((a, b) => {
      const x = value(a, sort.key);
      const y = value(b, sort.key);
      const nx = num(x);
      const ny = num(y);
      const c = nx !== null && ny !== null ? nx - ny : x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
      return c * sort.dir || a.sort - b.sort;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sort, statuses]);

  const toggle = (key: string) => setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));
  const head = (key: string, label: string) => {
    const active = sort?.key === key;
    const Icon = !active ? ChevronsUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <TableHead key={key} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => toggle(key)}
          className={`inline-flex items-center gap-1 uppercase tracking-[0.15em] hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${active ? "text-primary" : ""}`}
        >
          {label}
          <Icon className="h-3 w-3" aria-hidden />
        </button>
      </TableHead>
    );
  };

  return (
    <Card variant="flat" className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {head("title", "Title")}
            {columns.map((c) => head(c.key, c.label))}
            {extraColumn && <TableHead>{extraColumn.label}</TableHead>}
            {head("status", "Status")}
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((it, i) => (
            <tr className="animate-enter border-b border-hairline transition-colors hover:bg-subtle" style={{ animationDelay: `${(Math.min(i * 0.025, 0.25)) * 1000}ms` }} key={it.id}>
              <TableCell className="max-w-88 font-medium text-primary">
                <button type="button" onClick={() => onOpen(it.id)} className="text-left wrap-anywhere hover:text-link focus-visible:outline-hidden focus-visible:underline">
                  {it.title}
                </button>
              </TableCell>
              {columns.map((c) => (
                <TableCell key={c.key} className="max-w-[16rem] truncate font-mono text-xs" title={prim(it.data[c.key])}>
                  {prim(it.data[c.key]) || <span className="text-muted">-</span>}
                </TableCell>
              ))}
              {extraColumn && <TableCell>{extraColumn.render(it)}</TableCell>}
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={statusTone(it.status)}>{it.status}</StatusBadge>
                  <NativeSelect
                    value={it.status}
                    onChange={(e) => void onStatus(it.id, e.target.value)}
                    aria-label={`Status of ${it.title}`}
                    className="h-8 w-28 text-xs"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <button
                  type="button"
                  onClick={() => onOpen(it.id)}
                  className="rounded-md px-2 py-1 text-xs text-secondary hover:text-link focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
                  aria-label={`Open ${it.title}`}
                >
                  Open
                </button>
              </TableCell>
            </tr>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
