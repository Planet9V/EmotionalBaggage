// shadcn/ui Table, themed to Eigenia's design tokens (see button.tsx for why the
// token layer differs from shadcn's defaults: no opacity modifier on a var()-backed token).
import * as React from "react";
import { cn } from "@/lib/utils";

/** `scroll={false}` for a table that is only read aloud (inside `sr-only`): nothing to scroll, nothing to focus. */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement> & { scroll?: boolean }>(({ className, scroll = true, ...props }, ref) => {
  const table = <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />;
  // A region that scrolls sideways takes the keyboard too, so its content can be reached without a mouse.
  return scroll ? (
    <div className="relative w-full overflow-x-auto" tabIndex={0} role="region" aria-label={props["aria-label"] ?? "Table, scrolls sideways"}>
      {table}
    </div>
  ) : (
    table
  );
});
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-hairline", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />,
);
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn("border-b border-hairline transition-colors hover:bg-subtle", className)} {...props} />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn("h-9 px-3 text-left align-middle font-mono text-[10px] font-normal uppercase tracking-[0.15em] text-muted", className)}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("px-3 py-2 align-middle text-secondary", className)} {...props} />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => <caption ref={ref} className={cn("mt-3 text-xs text-muted", className)} {...props} />,
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption };
