// shadcn/ui Dialog, themed to Eigenia's design tokens (ADR-0001 3.6).
//
// Real shadcn/ui structure over Radix Dialog (@radix-ui/react-dialog): the
// accessibility — focus management, Escape-to-close, aria-modal/labelledby,
// portal — comes from Radix, not hand-rolled. Classes use Eigenia tokens only
// (bg-surface, border-hairline, text-primary/secondary/muted); no var()-backed
// token ever takes an opacity modifier (audit-dead-opacity discipline). The
// overlay uses charcoal (a real hex scale) so it can carry an opacity safely.
//
// DialogContent carries no positioning of its own so a caller can place it
// (the chat docks it bottom-right, non-modal, with no overlay). Compose
// DialogOverlay explicitly only when a modal scrim is wanted.
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-40 bg-charcoal-600/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * The last element that had focus outside every dialog. A field with autoFocus inside a dialog takes focus
 * before Radix's open event, so `document.activeElement` at that moment is already inside; this is not.
 */
let lastOutside: HTMLElement | null = null;
if (typeof document !== "undefined") {
  const note = (e: Event) => {
    const t = e.target;
    if (t instanceof HTMLElement && t !== document.body && !t.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) lastOutside = t;
  };
  // "focus" in the capture phase as well as "focusin": some environments send only one of them.
  document.addEventListener("focusin", note, true);
  document.addEventListener("focus", note, true);
}

/** The element focused when a dialog opened, if it is still on the page and can take focus. */
function usable(el: HTMLElement | null | undefined) {
  return el && el.isConnected && el !== document.body && !el.closest("[inert]") ? el : null;
}

/**
 * Focus goes back where it came from when any dialog closes (Escape, Close, Save): to `returnFocus()` when
 * the caller names an element (the new row after a create), else to the element that opened the dialog.
 * Radix returns focus only to a DialogTrigger, and most dialogs here are opened from state, which left
 * focus on the page body. A row that renders a moment after the close is focused on the next frame.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  // showCloseButton is accepted because shadcn/ui components pass it; this dialog draws no close button of its own.
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { showCloseButton?: boolean; returnFocus?: () => HTMLElement | null | undefined }
>(({ className, children, showCloseButton, returnFocus, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const opener = React.useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Content
      data-close-button={showCloseButton ? "" : undefined}
      ref={ref}
      className={cn(
        "z-50 flex flex-col overflow-hidden border border-hairline bg-surface shadow-2xl",
        className
      )}
      onOpenAutoFocus={(e) => {
        const a = document.activeElement;
        // Inside this dialog already (a field with autoFocus): the opener is the last element outside every dialog.
        // Inside another dialog (a confirm opened from a dialog): that element is the opener.
        const box = e.target instanceof HTMLElement ? e.target : null;
        const inside = a instanceof HTMLElement && !!box?.contains(a);
        opener.current = a instanceof HTMLElement && a !== document.body && !inside ? a : lastOutside;
        onOpenAutoFocus?.(e);
      }}
      onCloseAutoFocus={(e) => {
        onCloseAutoFocus?.(e);
        if (e.defaultPrevented) return;
        const named = usable(returnFocus?.());
        // Radix sends no open event when a field inside took focus first (autoFocus): then the last element
        // focused outside every dialog is the opener.
        const back = named ?? usable(opener.current) ?? usable(lastOutside);
        if (!back) return; // Radix's own handling: a DialogTrigger, if there is one
        e.preventDefault();
        back.focus();
        requestAnimationFrame(() => {
          const later = usable(returnFocus?.()) ?? (document.activeElement === document.body ? (usable(opener.current) ?? usable(lastOutside)) : null);
          if (later && later !== document.activeElement) later.focus();
        });
      }}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-sm font-semibold text-primary", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-[11px] leading-snug text-muted", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export {
  Dialog,
  DialogHeader,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogPrimitive,
};
