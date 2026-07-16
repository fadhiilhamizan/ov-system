"use client";
import * as React from "react";
import * as DP from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DP.Root;
export const DropdownMenuTrigger = DP.Trigger;
export const DropdownMenuGroup = DP.Group;
export const DropdownMenuSub = DP.Sub;
export const DropdownMenuRadioGroup = DP.RadioGroup;

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

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DP.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DP.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DP.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2.5 text-sm outline-none transition-colors focus:bg-muted",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2.5 flex size-4 items-center justify-center">
      <DP.ItemIndicator>
        <Check className="size-4" />
      </DP.ItemIndicator>
    </span>
    {children}
  </DP.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DP.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DP.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DP.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2.5 text-sm outline-none transition-colors focus:bg-muted",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
      <DP.ItemIndicator>
        <Circle className="size-2 fill-current" />
      </DP.ItemIndicator>
    </span>
    {children}
  </DP.RadioItem>
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

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

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DP.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DP.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <DP.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none focus:bg-muted data-[state=open]:bg-muted",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto size-4" />
  </DP.SubTrigger>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DP.SubContent>,
  React.ComponentPropsWithoutRef<typeof DP.SubContent>
>(({ className, ...props }, ref) => (
  <DP.Portal>
    <DP.SubContent
      ref={ref}
      className={cn(
        "z-50 min-w-[10rem] overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-xl data-[state=open]:animate-[fade-in_0.15s_ease]",
        className,
      )}
      {...props}
    />
  </DP.Portal>
));
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";
