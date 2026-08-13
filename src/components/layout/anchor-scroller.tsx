"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { scrollToAnchor } from "@/lib/scroll-to-anchor";

/**
 * Applies the URL's `#anchor` after every navigation.
 *
 * Mounted once in the app shell rather than per page, so any link anywhere in
 * the app (Violet's shortcuts, the guide, a bookmark someone shared in the
 * group chat) lands on its section.
 *
 * `usePathname` is the trigger because there is no hook for the hash: it does
 * not reach the server and Next does not re-render on a hash-only change. The
 * `hashchange` listener covers that second case.
 */
export function AnchorScroller() {
  const pathname = usePathname();

  React.useEffect(() => {
    const cancel = scrollToAnchor();
    const onHash = () => scrollToAnchor();
    window.addEventListener("hashchange", onHash);
    return () => {
      cancel();
      window.removeEventListener("hashchange", onHash);
    };
  }, [pathname]);

  return null;
}
