import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";

// ============================================================
// The presence beacon's cost, which nobody sees.
//
// It renders nothing and never toasts, so the only way it can go wrong is
// quietly: too many writes, or a rejection escaping into the error log it is
// itself supposed to feed. Both are pinned here.
// ============================================================
const actions = vi.hoisted(() => ({
  heartbeatAction: vi.fn(async () => {}),
  reportErrorAction: vi.fn(async () => {}),
}));
vi.mock("@/lib/actions/developer", () => actions);
vi.mock("next/navigation", () => ({ usePathname: () => "/tasks" }));
vi.mock("@/lib/dev-console", () => ({ installConsoleCapture: () => () => {} }));

const { SessionBeacons, isKnownBenignError } = await import("./session-beacons");

/** Ask the browser to re-run the visibility listeners. */
function altTab() {
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("presence heartbeat", () => {
  it("beats once on mount", () => {
    render(<SessionBeacons networkEnabled />);
    expect(actions.heartbeatAction).toHaveBeenCalledTimes(1);
    expect(actions.heartbeatAction).toHaveBeenCalledWith("/tasks");
  });

  it("does not beat again for every tab switch", () => {
    // REGRESSION: visibilitychange called the action directly, so flipping
    // between two tabs was one server action POST, one auth round trip and one
    // upsert PER SWITCH - for a row whose whole meaning is "seen recently".
    render(<SessionBeacons networkEnabled />);
    for (let i = 0; i < 10; i++) altTab();
    expect(actions.heartbeatAction).toHaveBeenCalledTimes(1);
  });

  it("does beat when a real gap has passed", () => {
    // The throttle must not turn into a mute button: coming back after a while
    // is exactly when the presence list should update.
    render(<SessionBeacons networkEnabled />);
    act(() => { vi.advanceTimersByTime(20_000); });
    altTab();
    expect(actions.heartbeatAction).toHaveBeenCalledTimes(2);
  });

  it("keeps beating on its own timer", () => {
    render(<SessionBeacons networkEnabled />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(actions.heartbeatAction).toHaveBeenCalledTimes(2);
  });

  it("does not beat at all when the network side is off", () => {
    // Guests and demo mode: the tables are not there to write to.
    render(<SessionBeacons />);
    altTab();
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(actions.heartbeatAction).not.toHaveBeenCalled();
  });

  it("survives a rejected beat without an unhandled rejection", async () => {
    // A server action can reject before its body runs at all (the POST fails,
    // the app is mid-deploy). `void` on that promise made invisible plumbing
    // file an error report about itself.
    actions.heartbeatAction.mockRejectedValueOnce(new Error("failed to fetch"));
    const onUnhandled = vi.fn();
    process.on("unhandledRejection", onUnhandled);
    render(<SessionBeacons networkEnabled />);
    await act(async () => { await Promise.resolve(); });
    process.off("unhandledRejection", onUnhandled);
    expect(onUnhandled).not.toHaveBeenCalled();
  });
});

describe("benign error filter", () => {
  it("recognises React's streaming-completion race in every engine's wording", () => {
    expect(isKnownBenignError("Cannot read properties of null (reading 'parentNode')")).toBe(true);
    expect(isKnownBenignError('can\'t access property "parentNode", b is null')).toBe(true);
    expect(isKnownBenignError("null is not an object (evaluating 'a.parentNode')")).toBe(true);
  });

  it("lets a real error through", () => {
    expect(isKnownBenignError("TypeError: t.map is not a function")).toBe(false);
  });
});
