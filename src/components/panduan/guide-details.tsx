"use client";
import * as React from "react";

/**
 * One collapsible guide section, owning its own open state.
 *
 * The obvious implementation is a plain `<details open={i === 0}>` rendered on
 * the server, with the anchor scroller prising it open through the DOM when a
 * link points at it. That does not survive: React re-applies the `open` it
 * rendered and the section snaps shut again, which looked like the shortcut
 * scrolling to the right card and then bouncing off it.
 *
 * So the state lives here instead, and the hash is an input to it rather than
 * something applied on top of it. Read in an effect, not during render: the
 * hash never reaches the server, so using it as initial state would be a
 * hydration mismatch.
 *
 * `summary` and `children` are still rendered on the server and passed through.
 */
export function GuideDetails({
  sectionKey,
  defaultOpen,
  summary,
  children,
}: {
  sectionKey: string;
  defaultOpen: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  React.useEffect(() => {
    const apply = () => {
      if (window.location.hash.replace(/^#/, "") === `guide-${sectionKey}`) setOpen(true);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [sectionKey]);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="group"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      {children}
    </details>
  );
}
