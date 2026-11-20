"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

/** Modal shell shared by the add form and the item editor: scrim, centred panel, title, close button. */
export function ItemDialogShell({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="fixed left-1/2 top-1/2 max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl">
          <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">{eyebrow}</p>
              <DialogTitle className="mt-1 text-lg font-semibold tracking-tight [overflow-wrap:anywhere]">{title}</DialogTitle>
              <DialogDescription className="mt-0.5">{description}</DialogDescription>
            </div>
            <DialogClose
              className="rounded-md p-1.5 text-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dutchOrange"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </DialogClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
