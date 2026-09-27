import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import type { BackupMeta } from "@/lib/backup";

// Backup & Rollback only renders against the production database (the demo
// sandbox hides it), so the list's grouping and bulk selection are pinned here.
const actions = vi.hoisted(() => ({
  createBackupAction: vi.fn(), downloadBackupAction: vi.fn(), deleteBackupAction: vi.fn(),
  restoreBackupAction: vi.fn(), importBackupAction: vi.fn(), inspectBackupFileAction: vi.fn(),
  bulkDeleteBackupsAction: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/actions/backup", () => actions);
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { BackupPanel } = await import("./backup-panel");

// Two on 27 Sep and one on 20 Sep, in WIB. 20:00Z on the 26th is already the
// 27th in Asia/Jakarta, which is the day the committee would call it.
const BACKUPS: BackupMeta[] = [
  { id: "b1", kind: "manual", created_at: "2026-09-27T05:00:00Z" },
  { id: "b2", kind: "pre_restore", created_at: "2026-09-26T20:00:00Z" },
  { id: "b3", kind: "manual", created_at: "2026-09-20T03:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: { reload: vi.fn() }, writable: true });
});

describe("BackupPanel", () => {
  it("groups by day in WIB, newest day open, like the changelog", () => {
    const { container } = render(<BackupPanel initialBackups={BACKUPS} />);
    const days = container.querySelectorAll("details");
    expect(days).toHaveLength(2);
    expect(days[0].open).toBe(true);
    expect(days[1].open).toBe(false);
    expect(within(days[0] as HTMLElement).getAllByRole("checkbox")).toHaveLength(3); // day + 2 rows
  });

  it("ticking a day selects its rows and shows the bulk bar", () => {
    const { container } = render(<BackupPanel initialBackups={BACKUPS} />);
    const day = container.querySelectorAll("details")[0] as HTMLElement;
    fireEvent.click(within(day).getByLabelText("Pilih semua backup pada hari ini"));
    expect(screen.getByText("2 dipilih")).toBeTruthy();
    expect(screen.getByText("Unduh")).toBeTruthy();
  });

  it("deletes the selection in ONE bulk call after confirming", async () => {
    render(<BackupPanel initialBackups={BACKUPS} />);
    fireEvent.click(screen.getByLabelText("Pilih semua backup yang tampil"));
    expect(screen.getByText("3 dipilih")).toBeTruthy();
    fireEvent.click(screen.getByText("Hapus"));
    const dialog = await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.click(within(dialog).getByText(/Hapus/, { selector: "button" }));
    });
    expect(actions.bulkDeleteBackupsAction).toHaveBeenCalledTimes(1);
    expect(actions.bulkDeleteBackupsAction).toHaveBeenCalledWith(["b1", "b2", "b3"]);
  });
});
