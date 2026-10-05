import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `stack`: below md the table turns into one card per row (see `.table-stack`
 * in globals.css). Each cell then shows its `label` beside its value; cells
 * marked `cell="primary"` become the card's title, `select` / `actions` sit in
 * its corners, and `hide-mobile` cells are dropped. A wide table that needed a
 * sideways scroll to read one row is the main thing that made phones painful.
 */
export function Table({ className, stack, ...props }: React.HTMLAttributes<HTMLTableElement> & { stack?: boolean }) {
  return (
    <div className={cn("relative w-full", stack ? "md:overflow-x-auto" : "overflow-x-auto")}>
      <table className={cn("w-full caption-bottom text-sm", stack && "table-stack", className)} {...props} />
    </div>
  );
}
export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}
export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-border transition-colors hover:bg-muted/50", className)}
      {...props}
    />
  );
}
export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        // Capitalized Case as written, never `uppercase`: an all-caps header
        // hides which words are abbreviations (PIC, NRP, MC) and which are not.
        "h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
export type StackRole = "primary" | "select" | "actions" | "hide-mobile";

export function TableCell({
  className, label, cell, ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  /** Shown beside the value when a `stack` table becomes cards on a phone. */
  label?: string;
  /** Where this cell goes in that card. */
  cell?: StackRole;
}) {
  return (
    <td
      data-label={label || undefined}
      data-cell={cell}
      className={cn("px-3 py-3 align-middle", className)}
      {...props}
    />
  );
}
