import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { useModalLayer } from "./use-modal-layer";

// ============================================================
// What `aria-modal="true"` is supposed to mean.
//
// The palette and the drawer both carried that attribute while implementing
// none of it: Tab walked out into the page behind, Escape only worked from one
// specific input, the page kept scrolling under the overlay, and closing left
// focus on <body>. Each of the four is pinned separately here, because they
// fail independently and three of them are invisible unless you drive the app
// by keyboard.
// ============================================================

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useModalLayer<HTMLDivElement>(open, onClose);
  return (
    <>
      <button data-testid="trigger">Buka</button>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true">
          <button data-testid="first">Pertama</button>
          <input data-testid="middle" />
          <button data-testid="last">Terakhir</button>
        </div>
      )}
      <button data-testid="outside">Di luar</button>
    </>
  );
}

const at = () => (document.activeElement as HTMLElement | null)?.dataset?.testid;

beforeEach(() => {
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});
afterEach(() => {
  document.body.style.overflow = "";
});

describe("useModalLayer", () => {
  it("moves focus inside when nothing there holds it yet", () => {
    render(<Harness open onClose={() => {}} />);
    expect(at()).toBe("first");
  });

  it("leaves focus alone when the layer already has it", () => {
    // The palette's input carries autoFocus and is already focused by the time
    // the effect runs; stealing it back to the first element would put the
    // caret in the wrong place every time the palette opens.
    function Autofocused({ open }: { open: boolean }) {
      const ref = useModalLayer<HTMLDivElement>(open, () => {});
      return open ? (
        <div ref={ref} role="dialog" aria-modal="true">
          <button data-testid="first">Pertama</button>
          <input data-testid="middle" autoFocus />
        </div>
      ) : null;
    }
    render(<Autofocused open />);
    expect(at()).toBe("middle");
  });

  it("wraps Tab from the last element back to the first", () => {
    // REGRESSION: Tab used to walk straight out of the dialog and down the page
    // behind it, which for a keyboard user makes aria-modal a claim rather than
    // a container.
    const { getByTestId } = render(<Harness open onClose={() => {}} />);
    getByTestId("last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(at()).toBe("first");
  });

  it("wraps Shift+Tab from the first element back to the last", () => {
    const { getByTestId } = render(<Harness open onClose={() => {}} />);
    getByTestId("first").focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(at()).toBe("last");
  });

  it("leaves Tab alone in the middle of the list", () => {
    // The trap only intervenes at the two ends; interfering anywhere else would
    // break normal movement between the fields.
    const { getByTestId } = render(<Harness open onClose={() => {}} />);
    getByTestId("first").focus();
    const e = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it("closes on Escape pressed anywhere, not only in one input", () => {
    // REGRESSION: the palette caught Escape on its search input alone, so
    // arrowing down to a result and then pressing Escape did nothing at all.
    let closed = 0;
    const { getByTestId } = render(<Harness open onClose={() => { closed++; }} />);
    getByTestId("last").focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closed).toBe(1);
  });

  it("stops the page behind from scrolling, and lets it go again", () => {
    const { rerender } = render(<Harness open onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Harness open={false} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the scroll locked while a second layer is open on top", () => {
    // The palette opens from inside the drawer. Two layers each saving and
    // restoring body.overflow meant the inner one released the OUTER one's lock
    // on close, and the page started scrolling behind a drawer still on screen.
    function Two({ inner }: { inner: boolean }) {
      const outer = useModalLayer<HTMLDivElement>(true, () => {});
      const nested = useModalLayer<HTMLDivElement>(inner, () => {});
      return (
        <div ref={outer} role="dialog" aria-modal="true">
          <button>Luar</button>
          {inner && (
            <div ref={nested} role="dialog" aria-modal="true">
              <button>Dalam</button>
            </div>
          )}
        </div>
      );
    }
    const { rerender } = render(<Two inner />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Two inner={false} />);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("hands focus back to whatever opened it", () => {
    // Without this the next Tab restarts from the top of the document instead
    // of from the control the person was just using.
    const { getByTestId, rerender } = render(<Harness open={false} onClose={() => {}} />);
    getByTestId("trigger").focus();
    rerender(<Harness open onClose={() => {}} />);
    expect(at()).toBe("first");
    act(() => { rerender(<Harness open={false} onClose={() => {}} />); });
    expect(at()).toBe("trigger");
  });

  it("hands focus back to the trigger even when the layer autofocuses itself", () => {
    // REGRESSION, and one only a real browser showed: React applies autoFocus in
    // the commit's mutation phase, BEFORE passive effects run. Reading
    // document.activeElement when the layer opens therefore captured the
    // palette's own input, and closing "restored" focus to an element that was
    // being unmounted - which is to say, to nothing. Escape left focus on
    // <body> and the next Tab restarted from the top of the page.
    function WithAutofocus({ open }: { open: boolean }) {
      const ref = useModalLayer<HTMLDivElement>(open, () => {});
      return (
        <>
          <button data-testid="trigger">Buka</button>
          {open && (
            <div ref={ref} role="dialog" aria-modal="true">
              <input data-testid="inside" autoFocus />
            </div>
          )}
        </>
      );
    }
    const { getByTestId, rerender } = render(<WithAutofocus open={false} />);
    getByTestId("trigger").focus();
    rerender(<WithAutofocus open />);
    expect(at()).toBe("inside");
    act(() => { rerender(<WithAutofocus open={false} />); });
    expect(at()).toBe("trigger");
  });

  it("does nothing at all while closed", () => {
    let closed = 0;
    render(<Harness open={false} onClose={() => { closed++; }} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closed).toBe(0);
    expect(document.body.style.overflow).toBe("");
  });
});
