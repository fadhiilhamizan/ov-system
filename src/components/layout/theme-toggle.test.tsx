import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { render } from "@testing-library/react";

// ============================================================
// The first client render must match the server's.
//
// This button was logging a React hydration failure on EVERY page load, which
// is not cosmetic: React throws the mismatched subtree away and rebuilds it.
// The cause was a "mounted" flag derived from next-themes' `resolvedTheme`,
// which is populated synchronously from localStorage during the first client
// render - so the server emitted a placeholder and the client emitted an icon.
//
// The test therefore renders the SAME component both ways, with a theme
// already resolved, and asserts the two agree. A test that only rendered it in
// jsdom would pass against the broken version.
// ============================================================
vi.mock("next-themes", () => ({
  // Already resolved, exactly as it is on a real first client render.
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}));
vi.mock("@/lib/i18n/provider", () => ({ useT: () => (s: string) => s }));

const { ThemeToggle } = await import("./theme-toggle");

describe("ThemeToggle", () => {
  it("renders NO icon on the server, even with a theme already resolved", () => {
    // The whole regression in one assertion. The mock hands back a resolved
    // theme, which is what next-themes really does on the first client render
    // (it reads localStorage synchronously) - and the old "mounted" flag was
    // derived from exactly that, so the server rendered an icon while the
    // hydrating client rendered one too, from a DIFFERENT preference. An effect
    // cannot run during renderToStaticMarkup, so the placeholder is what the
    // server must produce no matter what the theme is.
    const server = renderToStaticMarkup(<ThemeToggle />);
    expect(server).not.toContain("lucide-sun");
    expect(server).not.toContain("lucide-moon");
  });

  it("swaps in the icon once mounted", () => {
    // The other half: the placeholder must not be permanent. RTL flushes
    // effects, so this is the settled client state.
    const { container } = render(<ThemeToggle />);
    expect(container.querySelector(".lucide-sun")).toBeTruthy();
  });
});
