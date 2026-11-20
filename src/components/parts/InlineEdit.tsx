"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Click to edit. Enter saves, Escape cancels, leaving the field saves.
 * `onSave` may return an error string; the field then stays open and shows it.
 */
export function InlineEdit({
  value,
  onSave,
  label,
  placeholder = "Add",
  mono = false,
  numeric = false,
  align = "left",
  className,
}: {
  value: string;
  onSave: (next: string) => string | void | Promise<string | void>;
  label: string;
  placeholder?: string;
  mono?: boolean;
  numeric?: boolean;
  align?: "left" | "right";
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  const settled = useRef(false);

  const open = () => {
    settled.current = false;
    setDraft(value);
    setError("");
    setEditing(true);
  };
  const cancel = () => {
    settled.current = true;
    setError("");
    setEditing(false);
  };
  const commit = async () => {
    if (settled.current) return;
    if (draft === value) return cancel();
    const err = await onSave(draft);
    if (err) {
      setError(err);
      return;
    }
    settled.current = true;
    setEditing(false);
  };

  const text = cn(mono && "font-mono", align === "right" && "text-right");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        aria-label={`Edit ${label}`}
        className={cn(
          "-mx-1.5 block w-full rounded-md px-1.5 py-1 text-sm transition hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dutchOrange",
          text,
          value ? "text-primary" : "text-muted",
          className
        )}
      >
        {value || placeholder}
      </button>
    );
  }
  return (
    <div className="-mx-1.5">
      <input
        autoFocus
        aria-label={label}
        aria-invalid={error ? true : undefined}
        inputMode={numeric ? "decimal" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className={cn(
          "h-8 w-full rounded-md border bg-surface px-1.5 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dutchOrange",
          error ? "border-danger" : "border-dutchOrange",
          text
        )}
      />
      {error ? <p role="alert" className="mt-0.5 px-1.5 text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
