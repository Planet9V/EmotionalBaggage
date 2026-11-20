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

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cn(
      "z-50 flex flex-col overflow-hidden border border-hairline bg-surface shadow-2xl",
      className
    )}
    {...props}
  >
    {children}
  </DialogPrimitive.Content>
));
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

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogPrimitive,
};
