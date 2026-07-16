"use client";
import * as React from "react";
import * as TP from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TP.Provider;
export const Tooltip = TP.Root;
export const TooltipTrigger = TP.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TP.Content>,
  React.ComponentPropsWithoutRef<typeof TP.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TP.Portal>
    <TP.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-slate-50 shadow-md data-[state=delayed-open]:animate-[fade-in_0.12s_ease] dark:bg-slate-100 dark:text-slate-900",
        className,
      )}
      {...props}
    />
  </TP.Portal>
));
TooltipContent.displayName = "TooltipContent";

export function SimpleTooltip({
  label,
  children,
  side = "top",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
