"use client";

import { useId, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type LinkOption = {
  id: number;
  /** null: the row has no key yet; picking it asks the parent to give it one */
  key: string | null;
  label: string;
  hint?: string;
};

/**
 * A searchable multi-select over rows of the concept. Chosen rows are chips with a remove button.
 * The list holds keys; `onAdd` runs when a row is picked (the parent saves), `onRemove` when a chip is removed.
 */
export function LinkPicker({
  label,
  noun,
  options,
  selected,
  onAdd,
  onRemove,
  disabled,
  emptyText,
}: {
  label: string;
  /** "test": used in the button and the empty text */
  noun: string;
  options: LinkOption[];
  selected: string[];
  onAdd: (option: LinkOption) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
  disabled?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const listId = useId();
  const byKey = new Map(options.flatMap((o) => (o.key ? [[o.key, o] as const] : [])));
  return (
    <div className="space-y-1.5">
      <p id={labelId} className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
        {label}
      </p>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-labelledby={labelId}>
          {selected.map((k) => {
            const o = byKey.get(k);
            return (
              <li key={k} className="inline-flex items-center gap-1 rounded-full border border-hairline bg-subtle py-0.5 pl-2.5 pr-1 text-xs text-primary">
                <span className="wrap-anywhere">{o ? o.label : k}</span>
                {!o && <span className="text-danger">(no such row)</span>}
                <button
                  type="button"
                  onClick={() => void onRemove(k)}
                  disabled={disabled}
                  aria-label={`Remove ${o ? o.label : k}`}
                  className="rounded-full p-0.5 text-muted hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange disabled:opacity-40"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={`Add a ${noun} to ${label.toLowerCase()}`}
            disabled={disabled}
            className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-hairline bg-surface px-3 text-sm text-secondary hover:border-dutchOrange focus-visible:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange disabled:opacity-40"
          >
            <span>{selected.length ? `Add another ${noun}` : `Choose ${noun}s`}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent id={listId} className="p-0">
          <Command label={`Search ${noun}s`}>
            <CommandInput placeholder={`Search ${noun}s`} />
            <CommandList>
              <CommandEmpty>{emptyText ?? `No ${noun} matches.`}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const on = !!o.key && selected.includes(o.key);
                  return (
                    <CommandItem
                      key={o.id}
                      value={`${o.label} ${o.hint ?? ""} ${o.key ?? ""} ${o.id}`}
                      onSelect={() => {
                        if (on && o.key) void onRemove(o.key);
                        else void onAdd(o);
                      }}
                    >
                      <Check className={`h-3.5 w-3.5 ${on ? "text-link" : "invisible"}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{o.label}</span>
                        {o.hint && <span className="block truncate text-[11px] text-muted">{o.hint}</span>}
                      </span>
                      {on && <span className="sr-only">selected</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
