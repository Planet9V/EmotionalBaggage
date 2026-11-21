"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

/**
 * The one centred modal: a title, an optional description, a scrolling body, and a close button.
 * Focus, Escape and the scrim come from Radix Dialog; focus returns to the opener on close (DialogContent). `width` is a CSS length for the wide cases.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  wide = false,
  width,
  returnFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  wide?: boolean;
  width?: string;
  /** the element to focus when the modal closes (the new row after a create); default: the opener */
  returnFocus?: () => HTMLElement | null | undefined;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          className={`fixed left-1/2 top-1/2 max-h-[88vh] -translate-x-1/2 -translate-y-1/2 rounded-xl ${width ? "" : wide ? "w-[min(52rem,94vw)]" : "w-[min(30rem,94vw)]"}`}
          style={width ? { width: `min(94vw, ${width})` } : undefined}
          returnFocus={returnFocus}
        >
          <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
            <div className="min-w-0">
              <DialogTitle className="text-base tracking-tight">{title}</DialogTitle>
              <DialogDescription className={description ? "mt-1 text-xs" : "sr-only"}>{description ?? title}</DialogDescription>
            </div>
            <DialogClose className="rounded-md p-1 text-muted transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange" aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </DialogClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
