"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type DragEndEvent,
  type DragStartEvent,
  type Announcements,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NativeSelect } from "@/components/ui/native-select";
import { toastError } from "@/components/ui/states";
import { statusTone } from "@/lib/statusTones";
import type { Column } from "@/lib/menu";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";
import { prim } from "./shared";

type Props = {
  items: Item[];
  statuses: string[];
  columns: Column[];
  onOpen: (id: number) => void;
  /** Resolves when the server accepted the move; rejects with the server's sentence when it refused (the screen has already rolled back). */
  onMove: (id: number, status: string) => unknown | Promise<unknown>;
  /** extra content under a card's fields, for sections that show more than columns (claims show evidence) */
  cardExtra?: (item: Item) => ReactNode;
  /** Replaces the card's content. `grip` is the drag handle to place in it; the article, focus ring and Move to list stay. */
  renderCard?: (item: Item, grip: ReactNode) => ReactNode;
  /** Words for the empty column hint. */
  emptyHint?: string;
};

// A pointer over a column wins; otherwise the nearest rectangle (keyboard drags have no pointer).
const collide: CollisionDetection = (args) => {
  const hit = pointerWithin(args);
  return hit.length ? hit : rectIntersection(args);
};

/**
 * A lifted card moves a whole column at a time: Right and Left go to the neighbouring column, other keys do
 * nothing. (The default moves 25 px a press, which never gets a card from one column to the next.)
 */
const columnJump: KeyboardCoordinateGetter = (event, { context: { active, collisionRect, droppableContainers } }) => {
  if (!active || (event.code !== "ArrowRight" && event.code !== "ArrowLeft")) return undefined;
  // Read the columns and the card from the page itself. dnd-kit measures its drop areas a moment after a
  // card is lifted, so its cached rectangles can still be missing when the arrow key arrives straight after
  // Space; with them missing the key did nothing.
  const columns = droppableContainers
    .getEnabled()
    .filter((c) => String(c.id).startsWith("col:"))
    .map((c) => c.node.current?.getBoundingClientRect())
    .filter((r): r is DOMRect => !!r && r.width > 0)
    .sort((x, y) => x.left - y.left);
  // The same holds for the lifted card's own rectangle: before the first measurement it is empty.
  const measured = collisionRect && collisionRect.width > 0 ? collisionRect : null;
  const card = measured ?? document.querySelector(`[data-card-id="${String(active.id)}"]`)?.getBoundingClientRect();
  if (!card || columns.length === 0) return undefined;
  const centre = card.left + card.width / 2;
  const here = columns.findIndex((r) => centre >= r.left && centre <= r.left + r.width);
  const to = columns[(here < 0 ? 0 : here) + (event.code === "ArrowRight" ? 1 : -1)];
  return to ? { x: to.left + 8, y: to.top + 8 } : undefined;
};

/**
 * Board layout: one column per status, on dnd-kit. Cards move by dragging the grip (mouse, touch, or the
 * keyboard: Space to lift, arrows to choose a column, Space to drop, Escape to cancel), by the Move to list
 * on the card, or by focusing a card and pressing Shift with the left or right arrow. What the screen reader
 * hears is what happened: a move is announced after the server answered, and a refused move says so, with
 * the server's reason, and where the card stays.
 */
export function Kanban({ items, statuses, columns, onOpen, onMove, cardExtra, renderCard, emptyHint }: Props) {
  const [say, setSay] = useState("");
  const [active, setActive] = useState<Item | null>(null);
  const refocus = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnJump }),
  );

  // After a keyboard move the card remounts in its new column; give it focus back.
  useEffect(() => {
    if (refocus.current == null) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-card-id="${refocus.current}"]`);
    if (el) {
      el.focus();
      refocus.current = null;
    }
  }, [items]);

  const count = (st: string) => items.filter((x) => x.status === st).length;

  const move = async (item: Item, status: string, viaKeyboard = false) => {
    if (item.status === status) return;
    const from = item.status;
    if (viaKeyboard) refocus.current = item.id;
    setSay(`Moving ${item.title} to ${status}.`);
    try {
      await onMove(item.id, status);
      // `items` is the list from before the move, so the card is not counted yet
      setSay(`${item.title} moved to ${status}. The ${status} column now has ${count(status) + 1}.`);
    } catch (e) {
      const reason = (e as Error).message || "The server refused the change.";
      refocus.current = viaKeyboard ? item.id : null;
      setSay(`${item.title} was not moved: ${reason} It stays in ${from}.`);
      toastError(`${item.title}: ${reason}`);
    }
  };

  const nameOf = (id: string | number) => items.find((i) => i.id === Number(id))?.title ?? "Card";
  const colOf = (id: unknown) => (typeof id === "string" && id.startsWith("col:") ? id.slice(4) : null);
  // The drag announcements say what is being done, never that a move has happened: that is announced once the server has answered.
  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Picked up ${nameOf(a.id)}. Use the arrow keys to choose a status, Space to drop, Escape to cancel.`,
    onDragOver: ({ active: a, over }) => (over && colOf(over.id) ? `${nameOf(a.id)} is over ${colOf(over.id)}.` : `${nameOf(a.id)} is not over a status.`),
    onDragEnd: ({ active: a, over }) => (over && colOf(over.id) ? `Dropped ${nameOf(a.id)} on ${colOf(over.id)}. Saving.` : `${nameOf(a.id)} was dropped outside a status and was not changed.`),
    onDragCancel: ({ active: a }) => `Cancelled. ${nameOf(a.id)} was not changed.`,
  };

  const onDragStart = (e: DragStartEvent) => setActive(items.find((i) => i.id === Number(e.active.id)) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const st = colOf(e.over?.id);
    const item = items.find((i) => i.id === Number(e.active.id));
    if (item && st) void move(item, st);
  };

  return (
    <div ref={root}>
      <p role="status" aria-live="polite" className="sr-only">
        {say}
      </p>
      <p className="mb-2 text-xs text-muted">Drag a card by its grip (Space to lift it from the keyboard), use its Move to list, or focus a card and press Shift with an arrow key.</p>
      <DndContext
        sensors={sensors}
        collisionDetection={collide}
        accessibility={{ announcements, screenReaderInstructions: { draggable: "Press Space to lift the card, the arrow keys to choose a status, Space to drop it, Escape to cancel." } }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
      >
        <div className="-mx-1 snap-x overflow-x-auto px-1 pb-3">
          <ol className="grid grid-flow-col auto-cols-[minmax(15rem,82vw)] gap-3 sm:auto-cols-[minmax(15rem,1fr)]">
            {statuses.map((st) => (
              <Column key={st} status={st} emptyHint={emptyHint} cards={items.filter((x) => x.status === st).sort((a, b) => a.sort - b.sort)}>
                {(it, i) => (
                  <BoardCard
                    key={it.id}
                    item={it}
                    index={i}
                    statuses={statuses}
                    columns={columns}
                    onOpen={onOpen}
                    extra={cardExtra?.(it)}
                    renderCard={renderCard}
                    onMove={(s, kb) => void move(it, s, kb)}
                  />
                )}
              </Column>
            ))}
          </ol>
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? <div className="rounded-lg border border-dutchOrange bg-surface p-2.5 text-[13px] font-semibold text-primary shadow-lg">{active.title}</div> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ status, cards, children, emptyHint }: { status: string; cards: Item[]; children: (it: Item, i: number) => ReactNode; emptyHint?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <li
      ref={setNodeRef}
      aria-label={`${status}: ${cards.length} items`}
      data-status={status}
      className={cn(
        "flex min-w-0 snap-start flex-col self-stretch overflow-hidden rounded-xl border bg-subtle transition-shadow duration-150",
        isOver ? "border-dutchOrange ring-2 ring-dutchOrange" : "border-hairline",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-2">
        <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>
        <span className="font-mono text-[11px] text-secondary" aria-hidden>
          {cards.length}
        </span>
      </div>
      <ul className="max-h-152 flex-1 space-y-2 overflow-y-auto p-2">
        {cards.map((it, i) => children(it, i))}
        {!cards.length && <li className="rounded-lg border border-dashed border-hairline px-2 py-4 text-center text-[11px] text-secondary">{emptyHint ?? "Drop an item here"}</li>}
      </ul>
    </li>
  );
}

function BoardCard({
  item,
  index,
  statuses,
  columns,
  onOpen,
  extra,
  renderCard,
  onMove,
}: {
  item: Item;
  index: number;
  statuses: string[];
  columns: Column[];
  onOpen: (id: number) => void;
  extra?: ReactNode;
  renderCard?: (item: Item, grip: ReactNode) => ReactNode;
  onMove: (status: string, viaKeyboard: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: item.id });
  const pos = statuses.indexOf(item.status);
  const key = (e: KeyboardEvent) => {
    if (!e.shiftKey || e.target !== e.currentTarget) return;
    const next = e.key === "ArrowRight" ? pos + 1 : e.key === "ArrowLeft" ? pos - 1 : -1;
    if (next >= 0 && next < statuses.length) {
      e.preventDefault();
      onMove(statuses[next]!, true);
    }
  };
  const grip = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Drag ${item.title}`}
      className="shrink-0 cursor-grab touch-none rounded text-muted hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange active:cursor-grabbing"
    >
      <GripVertical className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
  const pairs = columns.map((c) => ({ label: c.label, value: prim(item.data[c.key]) })).filter((p) => p.value);
  return (
    <li ref={setNodeRef} className={cn("animate-enter", isDragging && "opacity-40")} style={{ animationDelay: `${Math.min(index * 0.03, 0.24) * 1000}ms` }}>
      <article
        tabIndex={0}
        data-card-id={item.id}
        onKeyDown={key}
        aria-label={`${item.title}, ${item.status}`}
        aria-keyshortcuts="Shift+ArrowLeft Shift+ArrowRight"
        className="group rounded-lg border border-hairline bg-surface p-2.5 shadow-xs transition-colors duration-150 hover:border-dutchOrange/60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
      >
        {renderCard ? renderCard(item, grip) : (<>
        <div className="flex items-start gap-1.5">
          <span className="mt-0.5">{grip}</span>
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
        {extra && <div className="mt-2 pl-5">{extra}</div>}
        </>)}
        {!renderCard && <div className="mt-2 pl-5">
          <NativeSelect value={item.status} onChange={(e) => onMove(e.target.value, false)} aria-label={`Move ${item.title} to a status`} className="h-8 px-1.5 text-[11px] text-secondary">
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === item.status ? "Move to another status" : s}
              </option>
            ))}
          </NativeSelect>
        </div>}
      </article>
    </li>
  );
}
