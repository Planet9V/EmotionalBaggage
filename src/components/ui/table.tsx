// shadcn/ui Table, themed to Eigenia's design tokens (see button.tsx for why the
// token layer differs from shadcn's defaults: no opacity modifier on a var()-backed token).
import * as React from "react";
import { cn } from "@/lib/utils";

/** Whether a sideways-scrolling box has more to the right, kept up to date as it scrolls and resizes. */
function useMoreRight() {
  const box = React.useRef<HTMLDivElement>(null);
  const [more, setMore] = React.useState(false);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", check);
      ro?.disconnect();
    };
  }, []);
  return { box, more };
}

/** `scroll={false}` for a table that is only read aloud (inside `sr-only`): nothing to scroll, nothing to focus. */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement> & { scroll?: boolean }>(({ className, scroll = true, ...props }, ref) => {
  const { box, more } = useMoreRight();
  const table = <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />;
  // A region that scrolls sideways takes the keyboard too, so its content can be reached without a mouse; when
  // columns are out of sight to the right, a fade at the edge and a line under the table say so.
  return scroll ? (
    <div className="relative">
      <div ref={box} className="relative w-full overflow-x-auto" tabIndex={0} role="region" aria-label={props["aria-label"] ?? "Table, scrolls sideways"}>
        {table}
      </div>
      {more ? (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--bg-surface)] to-transparent" />
          <p className="px-3 pb-2 pt-1 text-right text-[11px] text-muted" data-testid="table-scroll-hint">More columns to the right: scroll sideways.</p>
        </>
      ) : null}
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
