"use client";

import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    <Select
      value={value || undefined}
      disabled={list.isPending}
      onValueChange={(v) => onPick(v === OTHER ? null : (all.find((m) => m.id === v) ?? null))}
    >
      <SelectTrigger id={id} className="w-full border-hairline bg-surface">
        <SelectValue placeholder={list.isPending ? "Reading the list" : "Choose a model"} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {(list.data?.makers ?? []).map((g) => (
          <SelectGroup key={g.maker}>
            <SelectLabel>{g.maker}</SelectLabel>
            {g.models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.model}
                {m.adapter === "file-only" ? " (file only)" : m.experimental ? " (experimental)" : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
        <SelectGroup>
          <SelectLabel>Another printer</SelectLabel>
          <SelectItem value={OTHER}>Not on the list</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
