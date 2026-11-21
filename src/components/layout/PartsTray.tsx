"use client";

import { GripVertical } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DRAG_MIME } from "./ThreeView";
import { Card } from "@/components/ui/Card";

const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

export type TrayPart = { id: number; label: string; title: string; placing: boolean };

export function PartsTray({ parts, selectedId, onPlace, onSelect }: { parts: TrayPart[]; selectedId: number | null; onPlace: (id: number) => void; onSelect: (id: number) => void }) {
  return (
    <Card variant="flat" as="section" aria-label="Parts tray" className="p-3">
      <div className="flex items-baseline justify-between px-1">
        <p className={eyebrow}>Parts tray</p>
        <span className="font-mono text-[10px] text-muted">{parts.length} without geometry</span>
      </div>
      {parts.length === 0 ? (
        <p className="mt-3 px-1 text-sm text-muted">
          Every part in the bill of materials has a place. New parts without geometry show up here.{" "}
          <Link href="/s/design/bom" className="text-link hover:underline">Open the bill of materials</Link>
        </p>
      ) : (
        <>
          <p className="mt-1 px-1 text-xs text-muted">Drag a part onto the Top view, or click Place. You then enter its size.</p>
          <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
            {parts.map((p) => (
              <li
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, String(p.id));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`flex items-center gap-1 rounded-md border px-1.5 py-1 ${p.id === selectedId ? "border-dutchOrange/40 bg-dutchOrange/10" : "border-hairline bg-canvas"}`}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                <button type="button" onClick={() => onSelect(p.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm text-primary">
                    {p.label !== p.title && <span className="mr-1 font-mono text-[11px] text-link">{p.label}</span>}
                    {p.title}
                  </span>
                </button>
                <Button variant="outline" size="chip" disabled={p.placing} onClick={() => onPlace(p.id)}>
                  {p.placing ? "Placing" : "Place"}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
