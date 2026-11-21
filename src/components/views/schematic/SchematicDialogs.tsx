"use client";

// The dialogs of the schematic: add or edit a wire, add a pin, place a part, add the first connection.
import { FirstConnection } from "@/components/schematic/FirstConnection";
import { PinDialog } from "@/components/schematic/PinDialog";
import { WireDialog, type WireDraft, type WireDialogMode } from "@/components/schematic/WireDialog";
import type { NetInfo, Part, XY } from "@/components/schematic/model";
import type { Wire } from "@/lib/domain";
import { Modal } from "@/components/ui/modal";

export type DialogState =
  | { kind: "wire"; mode: WireDialogMode }
  | { kind: "pin"; part: Part }
  | { kind: "place"; part: Part; at: XY | null }
  | { kind: "first" }
  | null;

export function SchematicDialogs({
  dialog,
  setDialog,
  parts,
  nets,
  pinsByRef,
  nextOrder,
  statuses,
  saveWire,
  removeWire,
  addPin,
  placePart,
}: {
  dialog: DialogState;
  setDialog: (d: DialogState) => void;
  parts: Part[];
  nets: NetInfo[];
  pinsByRef: Map<string, string[]>;
  nextOrder: number;
  statuses: string[];
  saveWire: (d: WireDraft, editing: Wire | null) => Promise<void>;
  removeWire: (w: Wire) => Promise<void>;
  addPin: (part: Part, pin: string) => Promise<void>;
  placePart: (part: Part, at: XY | null, pin: string) => Promise<void>;
}) {
  return (
    <>
      {dialog?.kind === "wire" && (
        <WireDialog
          key={dialog.mode.kind === "edit" ? `e${dialog.mode.wire.item.id}` : "new"}
          mode={dialog.mode}
          parts={parts}
          nets={nets}
          pinsByRef={pinsByRef}
          nextOrder={nextOrder}
          statuses={statuses}
          onClose={() => setDialog(null)}
          onSave={(d) => saveWire(d, dialog.mode.kind === "edit" ? dialog.mode.wire : null)}
          onDelete={dialog.mode.kind === "edit" ? () => removeWire((dialog.mode as { wire: Wire }).wire) : undefined}
        />
      )}
      {dialog?.kind === "pin" && (
        <PinDialog
          title={`Add a pin to ${dialog.part.ref}`}
          description={`${dialog.part.title}. The pin shows on the part straight away; drag from it to wire it. Its kind can be set in the bill of materials.`}
          existing={pinsByRef.get(dialog.part.ref) ?? []}
          submitLabel="Add pin"
          onClose={() => setDialog(null)}
          onSave={(pin) => addPin(dialog.part, pin)}
        />
      )}
      {dialog?.kind === "place" && (
        <PinDialog
          title={`Place ${dialog.part.ref}`}
          description={`${dialog.part.title}. It has no kind or library entry, so it has no pins yet. Name the first one, or choose its kind in the bill of materials.`}
          existing={pinsByRef.get(dialog.part.ref) ?? []}
          submitLabel="Place part"
          onClose={() => setDialog(null)}
          onSave={(pin) => placePart(dialog.part, dialog.at, pin)}
        />
      )}
      {dialog?.kind === "first" && (
        <Modal open onOpenChange={(o) => !o && setDialog(null)} title="Add first connection" description="Two parts and the pins the wire joins. It is saved with status to solder." width="560px">
          <FirstConnection parts={parts} nextOrder={nextOrder} onSave={(d) => saveWire(d, null)} onDone={() => setDialog(null)} />
        </Modal>
      )}
    </>
  );
}
