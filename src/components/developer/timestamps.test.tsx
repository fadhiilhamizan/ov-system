import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ago, full } from "./developer-view";
import { useNow } from "@/lib/use-now";

// ============================================================
// The two halves of the hydration failure this page shipped with.
//
// React #418 fired on every load of /developer and /settings, eight times in
// two days, and both causes were clocks read at render time:
//
//   * `full()` formatted without a `timeZone`, so the server printed UTC and
//     the browser printed WIB - the same instant, seven hours apart, as text;
//   * `ago()` and the online/offline split read `Date.now()` themselves, so the
//     server's answer and the hydrating browser's were a round trip apart.
//
// Both are only visible when the two sides disagree, which a jsdom-only test
// cannot show: it renders once, on one clock. So the server half runs through
// `renderToStaticMarkup` with `process.env.TZ` forced to UTC - the deployment's
// timezone, and the one a laptop in Jakarta never reproduces on its own.
// ============================================================

const REAL_TZ = process.env.TZ;

// 06:56 UTC is 13:56 in Jakarta, so a host-clock format and a pinned one cannot
// agree on this instant whichever machine runs the test.
const INSTANT = "2026-09-14T06:56:14.000Z";

beforeEach(() => {
  process.env.TZ = "UTC";
});
afterEach(() => {
  process.env.TZ = REAL_TZ;
  vi.useRealTimers();
});

describe("full()", () => {
  it("prints committee time even when the host runs on UTC", () => {
    expect(new Date(INSTANT).getHours()).toBe(6); // the host really is on UTC
    expect(full(INSTANT)).toBe("14 Sep 2026, 13.56.14");
  });

  it("gives the same answer on a host that runs on WIB", () => {
    const asUtcHost = full(INSTANT);
    process.env.TZ = "Asia/Jakarta";
    expect(full(INSTANT)).toBe(asUtcHost);
  });
});

describe("ago()", () => {
  it("is a function of its arguments, not of the clock it runs on", () => {
    const now = Date.parse(INSTANT);
    vi.useFakeTimers();
    vi.setSystemTime(now + 3_600_000); // an hour of drift between the two sides
    expect(ago(INSTANT, now + 120_000)).toBe("2 menit lalu");
  });
});

describe("useNow()", () => {
  it("renders the fallback on the server, never the local clock", () => {
    const serverNow = Date.parse(INSTANT);

    function Probe() {
      return <span>{ago(INSTANT, useNow(serverNow))}</span>;
    }

    vi.useFakeTimers();
    // A "browser" whose clock is a day ahead of the timestamp being rendered.
    vi.setSystemTime(serverNow + 86_400_000);
    // Static markup takes the server snapshot, so the label is the server's
    // ("0 detik lalu"), not this machine's ("1 hari lalu"). That is what makes
    // the hydrating render byte-identical to the HTML.
    expect(renderToStaticMarkup(<Probe />)).toBe("<span>0 detik lalu</span>");
  });
});
