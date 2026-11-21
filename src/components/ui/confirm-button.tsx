"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

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
