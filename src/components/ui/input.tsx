// shadcn/ui Input, themed to Eigenia's design tokens (see button.tsx).
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-9 w-full rounded-md border border-hairline bg-surface px-3 py-1 text-sm text-primary placeholder:text-muted focus-visible:border-dutchOrange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dutchOrange disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
