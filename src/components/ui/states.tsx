"use client";

// The six states of docs/design/visual-system.md, one way each, for the whole app:
// loading (LoadingBlocks), empty (EmptyState), error on load (LoadError), error on save (toastError, or
// SaveError / ErrorLine in a form), saved (SavedNote), not configured (NotSetUp).
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Inbox, RotateCw, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading in a shape of its own (a board, a chat, a list of rows): the caller's grey blocks inside the one
 * announced region. The only way to label a loading placeholder: a plain div or span may not carry an
 * aria-label (axe aria-prohibited-attr), and Skeleton refuses one.
 */
export function LoadingShape({ label, className, inline = false, children }: { label: string; className?: string; inline?: boolean; children: ReactNode }) {
  const Tag = inline ? "span" : "div";
  return (
    <Tag role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </Tag>
  );
}

/** Loading: grey blocks in the shape of what is coming. */
export function LoadingBlocks({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <LoadingShape label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-2xl border border-hairline bg-surface p-5">
          <Skeleton className="h-4 w-48 bg-subtle" />
          <Skeleton className="mt-3 h-3 w-full max-w-lg bg-subtle" />
          <Skeleton className="mt-4 h-9 w-full max-w-md bg-subtle" />
        </div>
      ))}
    </LoadingShape>
  );
}

/** Error on load: the message in place of the content, with a retry. */
export function LoadError({ message, onRetry, what }: { message: string; onRetry: () => void; what?: string }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      <span className="wrap-anywhere">{what ? `${what} could not be loaded. ${message}` : message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCw className="h-3.5 w-3.5" aria-hidden /> Try again
      </Button>
    </div>
  );
}

/**
 * Empty: the one empty state of the whole app. An icon, a title, one sentence saying why the rows matter,
 * the primary action, and (through `ai`, see SectionEmpty in components/drafts) "Draft with AI" or
 * "Set a model in Admin" where the section has a generator.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  children,
  action,
  ai,
  testId,
}: {
  icon?: LucideIcon;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  ai?: ReactNode;
  testId?: string;
}) {
  return (
    <div data-empty-state="" data-testid={testId} className="rounded-xl border border-hairline bg-surface px-6 py-8 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-subtle text-link">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      {title ? <p className="mt-3 text-base font-semibold tracking-tight text-primary">{title}</p> : null}
      {children ? <div className={`mx-auto max-w-xl text-sm text-secondary ${title ? "mt-1" : "mt-3"}`}>{children}</div> : null}
      {action || ai ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {ai}
        </div>
      ) : null}
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

/** An error line that screen readers announce. */
export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

/** A refused save inside a form: the server's sentence, announced and focused. The form keeps what was typed. */
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

/** Error on save for a change made in place (a card moved, a cell edited): a toast with the server's sentence. */
export function toastError(message: string) {
  toast.error(message);
}

/** Saved: a quiet line that the change took. Announced politely. */
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

/** The page has no open concept: loading blocks while the concept loads, then one sentence and the action. */
export function NoConcept({ loading }: { loading: boolean }) {
  if (loading) return <LoadingBlocks rows={2} label="Loading the concept" />;
  return (
    <EmptyState
      title="No concept is open"
      action={
        <Button asChild size="sm" variant="outline">
          <Link href="/new">Start a concept</Link>
        </Button>
      }
    >
      Pick a concept in the sidebar, or start a new one.
    </EmptyState>
  );
}
