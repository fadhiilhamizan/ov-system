import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, act } from "@testing-library/react";
import { AUTO, setModelPref, useModelPref, resetModelPrefForTests } from "./model-pref";

// ============================================================
// The model preference, read the way a server-rendered component has to.
//
// Violet is mounted in the app shell, so it renders on the server as well. The
// shape this replaced - useState(AUTO) plus an effect that reads storage - is
// the ThemeToggle bug AGENTS.md records: the server emits one thing, the client
// emits another, and React throws the subtree away on hydration. A jsdom-only
// test passes against the broken version, so the server snapshot is checked
// through renderToStaticMarkup, which is the only way to catch it.
// ============================================================

function Probe() {
  return <span data-testid="m">{useModelPref()}</span>;
}

beforeEach(() => {
  resetModelPrefForTests();
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("useModelPref", () => {
  it("renders AUTO on the server even when the client has a stored choice", () => {
    window.localStorage.setItem("ov.violet.model", "openai/gpt-oss-120b");
    resetModelPrefForTests();
    // No browser storage exists during a server render, so the snapshot React
    // hydrates against must be the default, not whatever this machine stored.
    expect(renderToStaticMarkup(<Probe />)).toContain(AUTO);
  });

  it("starts from the stored choice on the client", () => {
    window.localStorage.setItem("ov.violet.model", "openai/gpt-oss-120b");
    resetModelPrefForTests();
    render(<Probe />);
    expect(screen.getByTestId("m").textContent).toBe("openai/gpt-oss-120b");
  });

  it("ignores a stored id that is no longer offered", () => {
    // A model dropped from the picker must not be sent and rejected; it falls
    // back to AUTO, which always works.
    window.localStorage.setItem("ov.violet.model", "llama-3.3-70b-versatile");
    resetModelPrefForTests();
    render(<Probe />);
    expect(screen.getByTestId("m").textContent).toBe(AUTO);
  });

  it("re-renders every subscriber when the choice changes", () => {
    render(<Probe />);
    act(() => setModelPref("openai/gpt-oss-20b"));
    expect(screen.getByTestId("m").textContent).toBe("openai/gpt-oss-20b");
    expect(window.localStorage.getItem("ov.violet.model")).toBe("openai/gpt-oss-20b");
  });

  it("clears the stored value when set back to AUTO", () => {
    act(() => setModelPref("openai/gpt-oss-20b"));
    act(() => setModelPref(AUTO));
    expect(window.localStorage.getItem("ov.violet.model")).toBeNull();
  });

  it("survives storage that throws on read", () => {
    // A private window, or a browser set to block site data. Losing the
    // preference is fine; failing to render the chat is not.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("access denied");
    });
    resetModelPrefForTests();
    render(<Probe />);
    expect(screen.getByTestId("m").textContent).toBe(AUTO);
  });

  it("survives storage that throws on write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    render(<Probe />);
    act(() => setModelPref("openai/gpt-oss-20b"));
    // The choice still applies to this session, only the memory of it is lost.
    expect(screen.getByTestId("m").textContent).toBe("openai/gpt-oss-20b");
  });
});
