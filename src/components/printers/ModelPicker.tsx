"use client";

import { useQuery } from "@tanstack/react-query";
import { NativeSelect } from "@/components/ui/native-select";
import { messageOf } from "@/lib/queries";
import { printerFetchers, printerKeys, type PrinterModel } from "@/lib/printers/client";

const OTHER = "__other";

/**
 * "Pick a model from the supported list" (plan 6.0). Choosing one hands the model back; the form then sets the family and shows what to
 * switch on at the printer. "Not on the list" leaves the family to be chosen by hand.
 */
export function ModelPicker({ id, value, onPick }: { id: string; value: string; onPick: (m: PrinterModel | null) => void }) {
  const list = useQuery({ queryKey: printerKeys.models(), queryFn: ({ signal }) => printerFetchers.models({ signal }), staleTime: 5 * 60_000 });
  if (list.isError) return <p role="alert" className="text-sm text-danger">The supported-printer list could not be read: {messageOf(list.error)}</p>;
  const all = (list.data?.makers ?? []).flatMap((g) => g.models);
  return (
    <NativeSelect id={id} value={value} disabled={list.isPending} onChange={(e) => onPick(e.target.value === OTHER ? null : (all.find((m) => m.id === e.target.value) ?? null))}>
      <option value="" disabled>
        {list.isPending ? "Reading the list" : "Choose a model"}
      </option>
      {(list.data?.makers ?? []).map((g) => (
        <optgroup key={g.maker} label={g.maker}>
          {g.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.model}
              {m.adapter === "file-only" ? " (file only)" : m.experimental && !/\(experimental\)/i.test(m.model) ? " (experimental)" : ""}
            </option>
          ))}
        </optgroup>
      ))}
      <optgroup label="Another printer">
        <option value={OTHER}>Not on the list</option>
      </optgroup>
    </NativeSelect>
  );
}
