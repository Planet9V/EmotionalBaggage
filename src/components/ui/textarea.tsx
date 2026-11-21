// shadcn/ui Textarea, themed to the Eigenia tokens like Input (see input.tsx).
import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    data-slot="textarea"
    className={cn(
      "block w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus-visible:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
