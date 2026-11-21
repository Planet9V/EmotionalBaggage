// shadcn/ui Button, themed to Eigenia's design tokens (ADR-0001 3.6).
//
// Real shadcn/ui structure: class-variance-authority variants + Radix Slot for
// `asChild`. The variant classes are written against Eigenia's own tokens
// (bg-action, bg-surface, border-hairline, text-primary/secondary/muted)
// rather than shadcn's default token layer, so the button matches the rest of
// the site and never applies an opacity modifier to a var()-backed token
// (audit-dead-opacity discipline). Element-level opacity (hover/disabled) is
// fine because it dims the element, not a theme color's channel.
"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition ease-out-soft active:scale-[0.98] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-action text-white shadow-xs hover:bg-action-hover",
        outline: "border border-hairline bg-surface text-secondary hover:border-dutchOrange hover:text-link",
        ghost: "text-secondary hover:text-primary",
        subtle: "bg-subtle text-primary hover:bg-surface",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        icon: "h-9 w-9",
        chip: "h-auto px-2 py-1 text-[11px]",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
