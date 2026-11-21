"use client";

// Small pieces every Admin tab uses: the six states (loading, empty, not set up, error with retry, saving,
// saved), the inline result of a connection test, labelled fields and a confirm dialog.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import type { TestResult } from "@/lib/admin/client";

/** A panel: hairline border, surface fill, one heading. */
export function Panel({ title, description, actions, children, id }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string }) {
  const h = useId();
  return (
    <section aria-labelledby={id ?? h} className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={id ?? h} className="text-base font-semibold tracking-tight text-primary">{title}</h2>
          {description ? <div className="mt-1 max-w-2xl text-sm text-secondary">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Loading: grey blocks in the shape of what is coming. */
export function LoadingBlocks({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-2xl border border-hairline bg-surface p-5">
          <Skeleton className="h-4 w-48 bg-subtle" />
          <Skeleton className="mt-3 h-3 w-full max-w-lg bg-subtle" />
          <Skeleton className="mt-4 h-9 w-full max-w-md bg-subtle" />
        </div>
      ))}
    </div>
  );
}

/** Error on load: the message in place of the content, with a retry. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCw className="h-3.5 w-3.5" aria-hidden /> Try again
      </Button>
    </div>
  );
}

/** Empty: one sentence saying what will appear, and the one action that makes it appear. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline bg-subtle px-5 py-6 text-sm text-secondary">
      <p>{children}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Not set up: which setting is missing, with a link to it. */
export function NotSetUp({ children, href, label }: { children: ReactNode; href: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
      <span>{children}</span>
      <Button asChild variant="outline" size="sm">
        <Link href={href}>{label}</Link>
      </Button>
    </div>
  );
}

/** A refused save: the server's sentence, announced. The form keeps what was typed. */
export function SaveError({ message }: { message: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  if (!message) return null;
  return (
    <p ref={ref} tabIndex={-1} role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger focus:outline-hidden">
      {message}
    </p>
  );
}

/** Saved: a quiet line that the change took. Announced politely, gone after a few seconds. */
export function SavedNote({ show, children = "Saved." }: { show: boolean; children?: ReactNode }) {
  return (
    <span role="status" aria-live="polite" className="text-xs text-success">
      {show ? children : ""}
    </span>
  );
}

/** True for a few seconds after `mark()` is called, for the saved state. */
export function useFlag(ms = 4000): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (t.current) clearTimeout(t.current);
  }, []);
  return [
    on,
    () => {
      setOn(true);
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => setOn(false), ms);
    },
  ];
}

/** The answer of a connection test, inline: a success or failure line with the server's message. */
export function TestOutcome({ result, error, pending }: { result?: TestResult | null; error?: string; pending?: boolean }) {
  if (pending) {
    return (
      <p role="status" className="text-sm text-secondary">
        Testing the connection.
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>The test could not run: {error}</span>
      </p>
    );
  }
  if (!result) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      data-ok={result.ok}
      className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${result.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
    >
      {result.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <span>
        <span className="font-medium">{result.ok ? "It works. " : "It failed. "}</span>
        {result.message}
      </span>
    </p>
  );
}

/** A label above a control, with an optional hint under it that the control is described by. */
export function FormField({ id, label, hint, required, error, children }: { id: string; label: string; hint?: ReactNode; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
        {label}
        {required ? <span className="normal-case tracking-normal"> (required)</span> : null}
      </label>
      <div className="mt-1">{children}</div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** aria attributes for a control inside FormField. */
export const describe = (id: string, o: { hint?: boolean; error?: string }) => ({
  "aria-invalid": o.error ? true : undefined,
  "aria-describedby": [o.hint ? `${id}-hint` : "", o.error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined,
});

/** A button that asks before doing something that cannot be undone. */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  onConfirm,
  disabled,
  size = "sm",
}: {
  label: ReactNode;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  size?: "sm" | "xs";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size={size} disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="fixed left-1/2 top-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-2xl p-5">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-secondary">{body}</DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export const when = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
