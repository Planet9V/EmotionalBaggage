"use client";

// What the schematic shows before there is a canvas to draw on: no parts at all, or parts with no pins or wires yet.
import Link from "next/link";
import { Cable } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { EYEBROW } from "@/components/ui/field";
import { EmptyState, ErrorLine } from "@/components/ui/states";
import { FirstConnection } from "@/components/schematic/FirstConnection";
import type { Part } from "@/components/schematic/model";
import type { WireDraft } from "@/components/schematic/WireDialog";
import type { Wire } from "@/lib/domain";

/** No parts and no wires: points to the bill of materials. */
export function NoParts({ loadError }: { loadError: string }) {
  return (
    <div className="animate-enter space-y-3">
      {loadError && <ErrorLine>{loadError}</ErrorLine>}
      <EmptyState
        icon={Cable}
        title="No parts to connect yet"
        action={
          <Button asChild size="sm">
            <Link href="/s/design/bom">Open the parts list</Link>
          </Button>
        }
      >
        The wires drawn here become the build sheet, the harness and the electrical checks. Add parts first, each with a reference such as U1 and a kind, so each gets its pins.
      </EmptyState>
    </div>
  );
}

/** Parts exist but nothing has a pin or a wire: place a part, or type the first connection. */
export function StartSchematic({
  loadError,
  palette,
  parts,
  nextOrder,
  onPlace,
  saveWire,
  dialogs,
}: {
  loadError: string;
  palette: Part[];
  parts: Part[];
  nextOrder: number;
  onPlace: (ref: string, at: null) => void;
  saveWire: (d: WireDraft, editing: Wire | null) => Promise<void>;
  dialogs: ReactNode;
}) {
  return (
    <div className="animate-enter space-y-4">
      {loadError && <ErrorLine>{loadError}</ErrorLine>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-dashed border-hairline bg-subtle p-6">
          <p className={EYEBROW}>Start the schematic</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-primary">No wires yet</h3>
          <p className="mt-2 text-sm text-secondary">
            A part appears on the canvas once it has a pin: choose its kind or library entry in the bill of materials, or place it here and name its first pin. Then drag from one pin to another to add a wire.
          </p>
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {palette.map((p) => (
              <li key={p.item.id}>
                <button
                  type="button"
                  onClick={() => onPlace(p.ref, null)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2 py-1 text-xs transition-colors duration-150 hover:border-dutchOrange/40"
                  title={`Place ${p.ref} and name its first pin`}
                >
                  <span className="font-mono font-semibold text-link">{p.ref}</span>
                  <span className="max-w-[160px] truncate text-secondary">{p.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <Card variant="flat" className="p-6">
          <p className={EYEBROW}>Add first connection</p>
          <div className="mt-3">
            <FirstConnection parts={parts} nextOrder={nextOrder} onSave={(d) => saveWire(d, null)} />
          </div>
        </Card>
      </div>
      {dialogs}
    </div>
  );
}
