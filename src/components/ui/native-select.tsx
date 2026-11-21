// A native <select>, themed. Native on purpose: it works with every keyboard, screen reader and
// touch keyboard without help, and the app's forms hold short lists. For long, searchable lists use the
// Command component instead.
import * as React from "react";
import { cn } from "@/lib/utils";

const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    data-slot="native-select"
    className={cn(
      "h-9 w-full rounded-md border border-hairline bg-surface px-2 pr-8 text-sm text-primary focus-visible:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
