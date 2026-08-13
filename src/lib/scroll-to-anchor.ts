// ============================================================
// Make an in-page anchor actually land on its section.
//
// A shortcut that opens the right page but leaves you at the top of it is only
// half a shortcut, and Pengaturan and Panduan are both long pages where the
// interesting part is near the bottom. Three things break the browser's native
// `#hash` behaviour here, which is why this exists at all:
//
//   1. Client-side navigation. Next renders the destination AFTER the URL
//      changes, so at the moment the hash is applied the target element does
//      not exist yet. Hence the retry window rather than a single lookup.
//   2. <details> accordions. Panduan's guide sections and the FAQ are collapsed
//      by default, and a collapsed section has no layout to scroll to. Every
//      ancestor <details> is opened first.
//   3. The sticky topbar, which would otherwise cover the heading you just
//      jumped to. Hence the offset.
//
// It also flashes a ring on the target, because arriving silently in the
// middle of a long page reads like the link did nothing.
// ============================================================

/** Roughly the height of the sticky topbar, plus breathing room. */
const TOP_OFFSET = 88;

/** How long to keep looking for an element that a route change has not rendered yet. */
const MAX_WAIT_MS = 2500;
const POLL_MS = 60;

/**
 * When to do the whole thing again, in ms after the first attempt.
 *
 * Not paranoia: a page that switches tabs from its own effect (Panduan does)
 * re-renders the subtree we just scrolled to, which resets the <details> we
 * opened and moves the target under us. Re-applying is idempotent and cheap,
 * and it is the difference between landing on the section and landing 1500px
 * above it.
 */
const REASSERT_MS = [350, 900];

/** CSS class (see globals.css) that briefly outlines the landing section. */
export const ANCHOR_FLASH_CLASS = "anchor-flash";

function reveal(el: HTMLElement) {
  // A collapsed <details> has no height, so scrolling to it lands on whatever
  // happens to be next to it.
  //
  // BOTH directions matter. Ancestors are the obvious case (an anchor inside
  // an accordion), but the anchor usually sits on the section's WRAPPER with
  // the <details> inside it: Panduan puts the id on the Card and the accordion
  // one level down. Walking only upwards silently did nothing there.
  let node: HTMLElement | null = el;
  while (node) {
    if (node instanceof HTMLDetailsElement) node.open = true;
    node = node.parentElement;
  }
  for (const d of el.querySelectorAll("details")) d.open = true;
}

function scrollTo(el: HTMLElement, behavior: ScrollBehavior) {
  reveal(el);
  const top = el.getBoundingClientRect().top + window.scrollY - TOP_OFFSET;
  window.scrollTo({ top: Math.max(0, top), behavior });

  el.classList.remove(ANCHOR_FLASH_CLASS);
  // Force a reflow so re-adding the class restarts the animation when the same
  // anchor is opened twice in a row.
  void el.offsetWidth;
  el.classList.add(ANCHOR_FLASH_CLASS);
  window.setTimeout(() => el.classList.remove(ANCHOR_FLASH_CLASS), 2000);
}

/**
 * Scroll to `#id`, waiting for it to appear if a navigation is still settling.
 *
 * Safe to call with no hash, with an unknown id, or on the server (it no-ops).
 * Returns a cleanup function that cancels the wait.
 */
export function scrollToAnchor(hash?: string): () => void {
  if (typeof window === "undefined") return () => {};
  const id = decodeURIComponent((hash ?? window.location.hash).replace(/^#/, "")).trim();
  if (!id) return () => {};

  const timers: number[] = [];
  let raf = 0;

  const land = (behavior: ScrollBehavior) => {
    const el = document.getElementById(id);
    if (el) scrollTo(el, behavior);
  };

  const settle = () => {
    // One frame of slack: the page may still be laying out, and measuring
    // before that gives an offset that is wrong by a whole card.
    raf = requestAnimationFrame(() => land("smooth"));
    // The re-runs scroll INSTANTLY on purpose. "smooth" is a request, not a
    // promise: under prefers-reduced-motion the browser ignores it entirely
    // and the page does not move at all, which looked exactly like a dead
    // link. The first attempt animates for everyone else; these land it.
    for (const delay of REASSERT_MS) timers.push(window.setTimeout(() => land("auto"), delay));
  };

  if (document.getElementById(id)) {
    settle();
  } else {
    const started = Date.now();
    const poll = window.setInterval(() => {
      if (document.getElementById(id)) {
        window.clearInterval(poll);
        settle();
        return;
      }
      // Give up quietly. A stale anchor is not worth an error the user can see:
      // they are already on the right page, which was most of the point.
      if (Date.now() - started > MAX_WAIT_MS) window.clearInterval(poll);
    }, POLL_MS);
    timers.push(poll);
  }

  return () => {
    cancelAnimationFrame(raf);
    // setTimeout and setInterval share an id space, so one loop clears both.
    for (const id of timers) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
  };
}
