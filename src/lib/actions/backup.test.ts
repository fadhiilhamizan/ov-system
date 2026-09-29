import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppUser } from "@/lib/types";

// The bulk delete on Pengaturan > Backup & Rollback: admin-only like every
// other backup write, one statement for the whole selection, and an empty or
// malformed selection never reaches the database.
const currentUser = vi.fn<() => Promise<AppUser>>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const lib = vi.hoisted(() => ({
  createBackup: vi.fn(), listBackups: vi.fn(), getBackupData: vi.fn(), deleteBackup: vi.fn(),
  deleteBackups: vi.fn(async () => {}), restoreSnapshot: vi.fn(), parseSnapshot: vi.fn(),
}));
vi.mock("@/lib/backup", () => lib);

const { bulkDeleteBackupsAction } = await import("./backup");

const admin: AppUser = { id: "a", name: "Admin", email: "a@x", role: "admin" };
const staff: AppUser = { id: "s", name: "Staff", email: "s@x", role: "staff" };

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(admin);
});

describe("bulkDeleteBackupsAction", () => {
  it("deletes the whole selection in one call", async () => {
    expect(await bulkDeleteBackupsAction(["b1", "b2"])).toEqual({ ok: true });
    expect(lib.deleteBackups).toHaveBeenCalledTimes(1);
    expect(lib.deleteBackups).toHaveBeenCalledWith(["b1", "b2"]);
  });

  it("is refused for anyone but an admin", async () => {
    currentUser.mockResolvedValue(staff);
    expect((await bulkDeleteBackupsAction(["b1"])).ok).toBe(false);
    expect(lib.deleteBackups).not.toHaveBeenCalled();
  });

  it("refuses an empty selection", async () => {
    expect((await bulkDeleteBackupsAction([])).ok).toBe(false);
    expect(lib.deleteBackups).not.toHaveBeenCalled();
  });
});
