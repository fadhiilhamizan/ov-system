"use client";
import * as React from "react";
import * as DP from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DP.Root;
export const DropdownMenuTrigger = DP.Trigger;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DP.Content>,
  React.ComponentPropsWithoutRef<typeof DP.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DP.Portal>
    <DP.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[11rem] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl data-[state=open]:animate-[fade-in_0.15s_ease]",
        className,
      )}
      {...props}
    />
  </DP.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DP.Item>,
  React.ComponentPropsWithoutRef<typeof DP.Item> & { inset?: boolean; destructive?: boolean }
>(({ className, inset, destructive, ...props }, ref) => (
  <DP.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground",
      inset && "pl-8",
      destructive && "text-danger focus:bg-red-50 dark:focus:bg-red-500/10 [&_svg]:text-danger",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentPropsWithoutRef<typeof DP.Label> & { inset?: boolean }) {
  return (
    <DP.Label
      className={cn("px-2.5 py-1.5 text-xs font-medium text-muted-foreground", inset && "pl-8", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <DP.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} />;
}
