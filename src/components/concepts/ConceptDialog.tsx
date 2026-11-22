"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

/**
 * Modal shell for the Concepts page dialogs: scrim, centred panel, title, close button.
 * `onClosed` runs instead of Radix's own focus return, so the page can put focus back on the
 * row the dialog came from (or the next sensible place when that row has moved or gone).
 */
export function ConceptDialog({
  open,
  onOpenChange,
  onClosed,
  eyebrow,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          onOpenAutoFocus={(e) => {
            // Start in the field that matters (marked data-autofocus), not on the close button.
            const target = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>("[data-autofocus]");
            if (target) {
              e.preventDefault();
              target.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onClosed();
          }}
          className="fixed left-1/2 top-1/2 max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">{eyebrow}</p>
              <DialogTitle className="mt-1 text-lg font-semibold tracking-tight wrap-anywhere">{title}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-secondary">{description}</DialogDescription>
            </div>
            <DialogClose
              className="rounded-md p-1.5 text-muted hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </DialogClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

/** A refused action: the server's sentence, announced to screen readers. */
export function FormError({ message, id }: { message: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-3 rounded-md border border-hairline bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export const fieldLabel = "block font-mono text-[10px] uppercase tracking-[0.15em] text-muted";
