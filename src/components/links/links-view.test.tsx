import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { LinkItem, OVEvent } from "@/lib/types";

// ============================================================
// Super Link puts the edition chosen in the topbar switcher FIRST: that is the
// Ormawa Visit being worked on, so its links are the ones being looked for.
// ============================================================

vi.mock("@/lib/i18n/provider", () => ({ useT: () => (s: string) => s }));
vi.mock("@/lib/actions/links", () => ({
  createLinkAction: vi.fn(), updateLinkAction: vi.fn(), deleteLinkAction: vi.fn(), bulkDeleteLinksAction: vi.fn(),
}));
vi.mock("@/components/ui/import-xlsx", () => ({ ImportXlsxButton: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { LinksView } = await import("./links-view");

const ev = (id: string, title: string, order: number) =>
  ({ id, title, cabinet: "", order } as unknown as OVEvent);
const events = [ev("ov1", "OV Pertama", 1), ev("ov2", "OV Kedua", 2), ev("ov3", "OV Ketiga", 3)];

const link = (id: string, event_id: string | null): LinkItem => ({
  id, event_id, section: "", division: "", name: `Tautan ${id}`, url: "https://x.id/" + id, note: "", source: "manual",
} as unknown as LinkItem);

const headings = () => [...document.querySelectorAll("h3")].map((h) => h.textContent);

function mount(active: string) {
  return render(
    <LinksView
      // Deliberately listed with the active edition's links LAST.
      links={[link("a", "ov1"), link("n", null), link("c", "ov3"), link("b", "ov2")]}
      events={events}
      divisions={[]}
      defaultEventId={active}
      canCreate={false}
      canManage={false}
      canDelete={false}
    />,
  );
}

describe("Super Link group order", () => {
  it("shows the edition picked in the topbar first, then the others in order, unscoped last", () => {
    mount("ov2");
    expect(headings()).toEqual(["OV Kedua", "OV Pertama", "OV Ketiga", "Tanpa Ormawa Visit"]);
  });

  it("follows the switcher when it changes", () => {
    mount("ov3");
    expect(headings()[0]).toBe("OV Ketiga");
  });

  it("marks the group being viewed", () => {
    const { container } = mount("ov2");
    const first = container.querySelector("h3")!.parentElement!;
    expect(first.textContent).toContain("Sedang dilihat");
    expect([...container.querySelectorAll("h3")].slice(1).some((h) => h.parentElement!.textContent!.includes("Sedang dilihat"))).toBe(false);
  });
});
