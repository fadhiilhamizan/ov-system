"use client";
import * as React from "react";

// ============================================================
// The plumbing a hand-rolled `role="dialog"` needs, and that neither the
// command palette nor the mobile drawer had.
//
// Radix supplies all of this for the dialogs built on it (components/ui/dialog).
// These two are not: the palette is portalled by hand because the topbar's
// `backdrop-blur` makes it the containing block for `position: fixed`, and the
// drawer is a plain overlay. So both went out with an `aria-modal` attribute
// that promised behaviour nothing implemented:
//
//   * Tab walked straight out of the "modal" and down the page behind it, which
//     for a keyboard user means the dialog is a claim rather than a container;
//   * Escape only worked while the caret sat in the palette's own input, so
//     arrowing to a result and then pressing Escape did nothing, and the drawer
//     had no Escape at all;
//   * the page behind kept scrolling under the overlay;
//   * closing dropped focus back to <body>, so the next Tab restarted from the
//     top of the document instead of the control that opened the thing.
//
// One hook rather than two copies: they are the same four behaviours, and the
// version that gets forgotten is always the second one.
// ============================================================

/** Tab order inside the layer. `:not([disabled])` matters for the close button. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * A hidden element is still in the DOM and still matches the selector above, so
 * without a visibility test the trap can park focus somewhere nobody can see.
 *
 * `checkVisibility` is the right question to ask and every browser this ships to
 * answers it. jsdom does not implement it (there is no layout engine behind the
 * tests), so there the check is skipped rather than guessed at - the obvious
 * substitute, `offsetParent !== null`, reports null for EVERY element under
 * jsdom and would quietly empty the list, and it is also null for
 * `position: fixed` elements in a real browser, which is exactly what these two
 * layers are built out of.
 */
function visible(el: HTMLElement): boolean {
  return typeof el.checkVisibility === "function" ? el.checkVisibility() : true;
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => visible(el) || el === document.activeElement,
  );
}

/**
 * Nesting counter for the scroll lock.
 *
 * The palette can be opened from inside the mobile drawer, and two layers each
 * saving and restoring `body.style.overflow` means the inner one restores the
 * OUTER one's "hidden" on close, or worse, restores "" while the drawer is
 * still open and the page starts scrolling behind it. Only the first lock
 * touches the style, only the last releases it.
 */
let locks = 0;
let savedOverflow = "";
let savedPaddingRight = "";

function lockScroll(): () => void {
  if (locks++ === 0) {
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    // Removing the scrollbar shifts the layout by its width; pad it back or the
    // whole page jumps sideways when the dialog opens.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
  }
  return () => {
    if (--locks === 0) {
      document.body.style.overflow = savedOverflow;
      document.body.style.paddingRight = savedPaddingRight;
    }
  };
}

/**
 * Attach the returned ref to the element that IS the dialog (the one carrying
 * `role="dialog"`), and everything above applies while `open` is true.
 *
 * `onClose` is read through a ref, so passing an inline arrow does not re-run
 * the effect: re-running it would release and retake the scroll lock and move
 * focus on every render.
 */
export function useModalLayer<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
): React.RefObject<T | null> {
  const ref = React.useRef<T | null>(null);
  const closeRef = React.useRef(onClose);
  /** Where focus was before this layer opened, so it can go back there. */
  const returnToRef = React.useRef<HTMLElement | null>(null);
  // Kept fresh in an effect rather than assigned during render: writing to a ref
  // while rendering is not safe under concurrent rendering, and eslint's
  // react-hooks/refs rule rejects it. Declared BEFORE the effect below, so it is
  // already up to date by the time the listener there can fire.
  React.useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Note where focus is WHILE CLOSED, rather than reading activeElement when
  // the layer opens.
  //
  // Reading it on open looks right and is wrong: React applies `autoFocus` in
  // the commit's mutation phase, which happens BEFORE passive effects, so by the
  // time this hook runs the palette's own search input already holds focus and
  // the hook would faithfully "restore" focus to an element it is about to
  // unmount. That is exactly what the browser showed - Escape closed the palette
  // and left focus on <body>, so the next Tab restarted from the top of the page
  // rather than from the search button. Anything inside the layer is therefore
  // never a return target.
  React.useEffect(() => {
    if (open) return;
    const note = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      // Never treat focus INSIDE a dialog as somewhere to return to.
      //
      // Matched on the attributes rather than on this hook's own ref, and that
      // detail is the whole fix: React attaches a parent's ref in the layout
      // phase AFTER committing its children, so when the autofocused input
      // announces itself `ref.current` is still null and a containment test
      // against it silently passes. The `role`/`aria-modal` attributes are part
      // of the element from the moment it is created, so `closest` sees them.
      if (!el || el.closest('[aria-modal="true"], [role="dialog"]')) return;
      returnToRef.current = el;
    };
    if (document.activeElement !== document.body) {
      returnToRef.current = document.activeElement as HTMLElement;
    }
    document.addEventListener("focusin", note);
    return () => document.removeEventListener("focusin", note);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const releaseScroll = lockScroll();
    const returnTo = returnToRef.current;

    // Something inside must hold focus, or the trap has nothing to trap and a
    // screen reader stays outside the dialog. The palette's input carries
    // autoFocus and is already there by now; the drawer has nothing, so it gets
    // its first focusable element.
    const root = ref.current;
    if (root && !root.contains(document.activeElement)) {
      focusableIn(root)[0]?.focus();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const el = ref.current;
      if (!el) return;
      const items = focusableIn(el);
      if (!items.length) {
        // Nothing to move to: keep the caret where it is rather than letting
        // Tab escape to the page underneath.
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      const leavingBackwards = e.shiftKey && (at === first || !el.contains(at));
      const leavingForwards = !e.shiftKey && at === last;
      if (leavingBackwards || leavingForwards) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }

    // Bubble phase, not capture: a nested popover (a Radix Select inside the
    // drawer) handles its own Escape and stops it, and capture would close the
    // whole layer out from under it instead.
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
      // The element that opened this may be gone (the palette navigates away),
      // in which case there is nothing sensible to restore to.
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [open]);

  return ref;
}
