"use client";

import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NET_COLOR, type NetClass } from "@/lib/domain";
import { CLASS_LABEL } from "./model";

export const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";
export const FIELD_CLS =
  "w-full rounded-md border border-hairline bg-surface px-3 text-sm text-primary placeholder:text-muted focus-visible:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange disabled:opacity-50";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-secondary">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(FIELD_CLS, "h-9 pr-8", className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(FIELD_CLS, "py-2", className)} />;
}

export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

/** A coloured stroke and the class name: the word carries the meaning, the colour supports it. */
export function NetSwatch({ netClass, className = "" }: { netClass: NetClass; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className="inline-block h-[3px] w-4 rounded-full" style={{ background: NET_COLOR[netClass] }} />
      <span>{CLASS_LABEL[netClass]}</span>
    </span>
  );
}

/** A centred modal over a scrim, on the shared Radix dialog. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  width = "520px",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  width?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          className="fixed left-1/2 top-1/2 max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-xl"
          style={{ width: `min(94vw, ${width})` }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
            <div className="min-w-0">
              <DialogTitle className="text-base tracking-tight">{title}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">{description}</DialogDescription>
            </div>
            <DialogClose className="rounded-md p-1 text-muted transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange" aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </DialogClose>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
