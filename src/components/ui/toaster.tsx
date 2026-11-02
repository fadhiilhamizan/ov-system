"use client";
import { Toaster as RareToaster } from "@/components/ui/rare/toast";

// The animated Rare UI toast stack. Every caller imports `toast` from
// "@/components/ui/rare/toast", never straight from "sonner": a sonner toast
// would render with sonner's own default styling, not this card. The theme is
// not passed on purpose: the card is styled with the app's tokens, which
// already follow the `.dark` class next-themes sets.
export function Toaster() {
  return (
    <RareToaster
      position="bottom-right"
      // Clear of the bottom tab bar on a phone (it is lg:hidden).
      mobileOffset={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))", left: 12, right: 12 }}
    />
  );
}
