"use client";

// The Physical layout tab: the app's own orthographic view (ThreeView, the one the Physical layout page draws
// three of), top, front and side, to scale in millimetres, on the example's seeded part sizes and positions.
// Read-only: a drag pans, the buttons zoom and fit, and pressing a part names it; nothing can be moved.
import { useMemo, useState } from "react";
import { toPart } from "@/lib/domain";
import type { Item } from "@/lib/types";
import { insideOfOf } from "@/lib/geometry/overlap";
import { ThreeView } from "@/components/layout/ThreeView";
import { floorLevel, fmtMm, VIEW_DEFS, VIEW_ORDER, type LayoutPart } from "@/components/layout/geom";
import { ENGINEERING } from "./content";
import { StageBar, StageFoot, StageView } from "./StageParts";

const WALL = 2; // the Physical layout page's own default wall
const NONE = new Set<number>();
const noop = () => {};

export default function EngLayout({ parts: partItems }: { parts: Item[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const placed = useMemo(() => {
    const out: LayoutPart[] = [];
    for (const p of partItems.map(toPart)) {
      if (!p.geometry) continue;
      const inside = insideOfOf(p.item.data);
      out.push({ id: p.item.id, ref: p.ref, label: p.ref || p.item.title, geometry: p.geometry, ...(inside ? { insideOf: inside } : {}) });
    }
    return out;
  }, [partItems]);
  const shells = useMemo(() => placed.filter((p) => p.geometry.shape === "shell"), [placed]);
  const bodies = useMemo(() => placed.filter((p) => p.geometry.shape !== "shell"), [placed]);
  const floor = floorLevel(shells[0]?.geometry ?? null, WALL);
  const picked = placed.find((p) => p.id === selectedId);
  const pickedPart = picked ? partItems.find((i) => i.id === picked.id) : null;

  return (
    <>
      <StageBar path="/s/design/layout">
        <p className="font-mono text-[11px] text-muted">{ENGINEERING.layout.scale}</p>
      </StageBar>
      <StageView className="grid gap-2 p-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:grid-rows-2">
        {VIEW_ORDER.map((k) => (
          <div key={k} className={`min-h-0 ${k === "top" ? "lg:row-span-2" : ""}`}>
            <ThreeView
              view={VIEW_DEFS[k]}
              parts={bodies}
              shells={shells}
              markers={[]}
              wall={WALL}
              floor={floor}
              selectedId={selectedId}
              overlapping={NONE}
              snapOn={false}
              step={1}
              heightClass="h-full"
              onSelect={setSelectedId}
              onActivate={noop}
              onMove={noop}
              onCommit={noop}
              readOnly
            />
          </div>
        ))}
      </StageView>
      <StageFoot hint={<><span className="sm:hidden">{ENGINEERING.panTouch}</span><span className="hidden sm:inline">{ENGINEERING.layout.hint}</span></>} live={picked && pickedPart ? `${picked.ref} ${pickedPart.title}: ${picked.geometry.size.map(fmtMm).join(" x ")} mm` : ""}>
        {bodies.length + shells.length} of {partItems.length} parts have a size and are placed
      </StageFoot>
    </>
  );
}
