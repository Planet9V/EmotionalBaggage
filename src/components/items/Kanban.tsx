"use client";

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import type { Column } from "@/lib/menu";
import type { Item } from "@/lib/types";
import { prim } from "./shared";

type Props = {
  items: Item[];
  statuses: string[];
  columns: Column[];
  onOpen: (id: number) => void;
  onMove: (id: number, status: string) => void | Promise<void>;
};

/**
 * Board layout: one column per status. Cards move by drag and drop, by the Move to list on the card
 * (touch and screen readers) or by focusing a card and pressing Shift with the left or right arrow.
 * Every move is announced in a polite live region.
 */
export function Kanban({ items, statuses, columns, onOpen, onMove }: Props) {
  const reduce = useReducedMotion();
  const [over, setOver] = useState<string | null>(null);
  const [say, setSay] = useState("");
  const dragged = useRef<number | null>(null);
  const refocus = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // After a keyboard move the card remounts in its new column; give it focus back.
  useEffect(() => {
    if (refocus.current == null) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-card-id="${refocus.current}"]`);
    if (el) {
      el.focus();
      refocus.current = null;
    }
  }, [items]);

  const move = (item: Item, status: string, viaKeyboard = false) => {
    if (item.status === status) return;
    if (viaKeyboard) refocus.current = item.id;
    setSay(`${item.title} moved to ${status}. ${items.filter((x) => x.status === status).length + 1} in ${status}.`);
    void onMove(item.id, status);
  };

  const drop = (status: string) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const raw = e.dataTransfer.getData("text/plain");
    const id = raw ? Number(raw) : dragged.current;
    dragged.current = null;
    const item = items.find((x) => x.id === id);
    if (item) move(item, status);
  };

  return (
    <div ref={root}>
      <p role="status" aria-live="polite" className="sr-only">
        {say}
      </p>
      <p className="mb-2 text-xs text-muted">Drag a card, use its Move to list, or focus a card and press Shift with an arrow key.</p>
      <div className="-mx-1 snap-x overflow-x-auto px-1 pb-3">
        <ol className="grid grid-flow-col auto-cols-[minmax(15rem,82vw)] gap-3 sm:auto-cols-[minmax(15rem,1fr)]">
          {statuses.map((st) => {
            const cards = items.filter((x) => x.status === st).sort((a, b) => a.sort - b.sort);
            return (
              <li
                key={st}
                aria-label={`${st}: ${cards.length} items`}
                data-status={st}
                className={`flex min-w-0 snap-start flex-col self-stretch overflow-hidden rounded-xl border bg-subtle transition-shadow duration-150 ${
                  over === st ? "border-dutchOrange ring-2 ring-dutchOrange" : "border-hairline"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (over !== st) setOver(st);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
                }}
                onDrop={drop(st)}
              >
                <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-2">
                  <StatusBadge tone={statusTone(st)}>{st}</StatusBadge>
                  <span className="font-mono text-[11px] text-secondary" aria-hidden>
                    {cards.length}
                  </span>
                </div>
                <ul className="max-h-152 flex-1 space-y-2 overflow-y-auto p-2">
                  {cards.map((it, i) => (
                    <BoardCard
                      key={it.id}
                      item={it}
                      index={i}
                      reduce={!!reduce}
                      statuses={statuses}
                      columns={columns}
                      onOpen={onOpen}
                      onMove={(s, kb) => move(it, s, kb)}
                      onDragStart={(e) => {
                        dragged.current = it.id;
                        e.dataTransfer.setData("text/plain", String(it.id));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    />
                  ))}
                  {!cards.length && (
                    <li className="rounded-lg border border-dashed border-hairline px-2 py-4 text-center text-[11px] text-muted">Drop an item here</li>
                  )}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function BoardCard({
  item,
  index,
  reduce,
  statuses,
  columns,
  onOpen,
  onMove,
  onDragStart,
}: {
  item: Item;
  index: number;
  reduce: boolean;
  statuses: string[];
  columns: Column[];
  onOpen: (id: number) => void;
  onMove: (status: string, viaKeyboard: boolean) => void;
  onDragStart: (e: DragEvent) => void;
}) {
  const pos = statuses.indexOf(item.status);
  const key = (e: KeyboardEvent) => {
    if (!e.shiftKey || e.target !== e.currentTarget) return;
    const next = e.key === "ArrowRight" ? pos + 1 : e.key === "ArrowLeft" ? pos - 1 : -1;
    if (next >= 0 && next < statuses.length) {
      e.preventDefault();
      onMove(statuses[next]!, true);
    }
  };
  const pairs = columns.map((c) => ({ label: c.label, value: prim(item.data[c.key]) })).filter((p) => p.value);
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: reduce ? 0 : Math.min(index * 0.03, 0.24) }}
    >
      <article
        draggable
        tabIndex={0}
        data-card-id={item.id}
        onDragStart={onDragStart}
        onKeyDown={key}
        aria-label={`${item.title}, ${item.status}`}
        aria-keyshortcuts="Shift+ArrowLeft Shift+ArrowRight"
        className="group cursor-grab rounded-lg border border-hairline bg-surface p-2.5 shadow-xs transition-colors duration-150 hover:border-dutchOrange/60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange active:cursor-grabbing"
      >
        <div className="flex items-start gap-1.5">
          <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="min-w-0 flex-1 text-left text-[13px] font-semibold leading-snug text-primary wrap-anywhere hover:text-link focus:outline-hidden focus-visible:underline"
          >
            {item.title}
          </button>
        </div>
        {item.body && <p className="mt-1.5 line-clamp-2 pl-5 text-xs leading-snug text-secondary">{item.body}</p>}
        {pairs.length > 0 && (
          <dl className="mt-2 space-y-0.5 pl-5">
            {pairs.map((p) => (
              <div key={p.label} className="flex min-w-0 gap-1.5 font-mono text-[10px]">
                <dt className="shrink-0 uppercase tracking-widest text-muted">{p.label}</dt>
                <dd className="min-w-0 truncate text-secondary" title={p.value}>
                  {p.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-2 pl-5">
          <select
            value={item.status}
            onChange={(e) => onMove(e.target.value, false)}
            aria-label={`Move ${item.title} to a status`}
            className="h-8 w-full rounded-md border border-hairline bg-canvas px-1.5 text-[11px] text-secondary hover:border-dutchOrange/60 focus:border-dutchOrange focus:outline-hidden"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === item.status ? "Move to another status" : s}
              </option>
            ))}
          </select>
        </div>
      </article>
    </motion.li>
  );
}
