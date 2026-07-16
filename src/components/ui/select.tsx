"use client";
import * as React from "react";
import * as SP from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SP.Root;
export const SelectGroup = SP.Group;
export const SelectValue = SP.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SP.Trigger>,
  React.ComponentPropsWithoutRef<typeof SP.Trigger>
>(({ className, children, ...props }, ref) => (
  <SP.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SP.Icon asChild>
      <ChevronDown className="size-4 opacity-60" />
    </SP.Icon>
  </SP.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SP.Content>,
  React.ComponentPropsWithoutRef<typeof SP.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SP.Portal>
    <SP.Content
      ref={ref}
      position={position}
      className={cn(
        "relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl data-[state=open]:animate-[fade-in_0.15s_ease]",
        position === "popper" && "w-[var(--radix-select-trigger-width)]",
        className,
      )}
      {...props}
    >
      <SP.Viewport className="p-1.5">{children}</SP.Viewport>
    </SP.Content>
  </SP.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SP.Item>,
  React.ComponentPropsWithoutRef<typeof SP.Item>
>(({ className, children, ...props }, ref) => (
  <SP.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2.5 text-sm outline-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2.5 flex size-4 items-center justify-center">
      <SP.ItemIndicator>
        <Check className="size-4" />
      </SP.ItemIndicator>
    </span>
    <SP.ItemText>{children}</SP.ItemText>
  </SP.Item>
));
SelectItem.displayName = "SelectItem";

export function SelectLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof SP.Label>) {
  return <SP.Label className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)} {...props} />;
}
