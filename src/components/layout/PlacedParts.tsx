"use client";

import { Card } from "@/components/ui/Card";

/**
 * The parts already on the canvas, as a list of buttons (U9): the keyboard way to select one. Choosing a part
 * selects it and moves focus to the layout, where the arrow keys nudge it (Shift for ten steps).
 */
export function PlacedParts({ parts, selectedId, onSelect }: { parts: { id: number; label: string }[]; selectedId: number | null; onSelect: (id: number) => void }) {
  if (!parts.length) return null;
  return (
    <Card variant="flat" as="section" aria-label="Placed parts" className="p-3">
      <p className="px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-link">Placed parts</p>
      <p className="mt-1 px-1 text-xs text-muted">Choose one, then use the arrow keys to move it.</p>
      <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
        {parts.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={p.id === selectedId}
              onClick={() => {
                onSelect(p.id);
                // The layout's own key handler moves the selected part; it ignores keys sent to a button.
                requestAnimationFrame(() => document.getElementById("layout-workspace")?.focus());
              }}
              className={`w-full truncate rounded-md border px-2 py-1 text-left text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${
                p.id === selectedId ? "border-dutchOrange/40 bg-dutchOrange/10 text-primary" : "border-hairline bg-canvas text-secondary hover:text-primary"
              }`}
            >
              {p.label}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
