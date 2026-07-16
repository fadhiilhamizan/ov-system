"use client";
import * as React from "react";
import * as PP from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PP.Root;
export const PopoverTrigger = PP.Trigger;
export const PopoverAnchor = PP.Anchor;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PP.Content>,
  React.ComponentPropsWithoutRef<typeof PP.Content>
>(({ className, align = "center", sideOffset = 6, ...props }, ref) => (
  <PP.Portal>
    <PP.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl outline-none data-[state=open]:animate-[fade-in_0.15s_ease]",
        className,
      )}
      {...props}
    />
  </PP.Portal>
));
PopoverContent.displayName = "PopoverContent";
