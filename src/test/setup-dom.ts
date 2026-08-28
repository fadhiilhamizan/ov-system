import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// ============================================================
// Setup for the "components" project (see vitest.config.ts).
//
// Two jobs: unmount between tests, and fill the gaps where jsdom is not a
// browser. Radix primitives (Popover, Select, Dialog - this app uses all
// three) call layout APIs that jsdom does not implement, and the failure is a
// bare TypeError inside node_modules that says nothing about the component
// under test. Polyfilling them here keeps that noise out of every test file.
// ============================================================

afterEach(() => {
  cleanup();
});

// React Testing Library unmounts into a DOM that has to still be there.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    root = null;
    rootMargin = "";
    thresholds: number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof matchMedia;
}

// Radix's pointer handling and scroll-into-view, absent from jsdom.
for (const fn of ["hasPointerCapture", "setPointerCapture", "releasePointerCapture"] as const) {
  if (!Element.prototype[fn]) {
    Object.defineProperty(Element.prototype, fn, { value: () => false, writable: true });
  }
}
if (!Element.prototype.scrollIntoView) {
  Object.defineProperty(Element.prototype, "scrollIntoView", { value: () => {}, writable: true });
}
