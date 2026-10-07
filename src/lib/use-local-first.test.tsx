import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { useLocalFirst } = await import("./use-local-first");

type Row = { id: string; title: string; status: string };
const A: Row = { id: "a", title: "A", status: "todo" };
const B: Row = { id: "b", title: "B", status: "todo" };

/** A save that resolves only when the test says so. */
function deferred(ok = true, error?: string) {
  let resolve!: () => void;
  const p = new Promise<{ ok: boolean; error?: string }>((r) => { resolve = () => r({ ok, error }); });
  return { save: vi.fn(() => p), resolve };
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => vi.clearAllMocks());

describe("useLocalFirst", () => {
  it("shows a patch immediately and drops it once the server rows catch up", async () => {
    const { result, rerender } = renderHook(({ rows }) => useLocalFirst(rows), { initialProps: { rows: [A, B] } });
    const d = deferred();
    act(() => { void result.current.patch("a", { status: "done" }, d.save); });
    expect(result.current.rows[0].status).toBe("done");
    expect(result.current.busy).toBe(true);
    d.resolve();
    await flush();
    // The revalidation brings the stored value.
    rerender({ rows: [{ ...A, status: "done" }, B] });
    expect(result.current.rows[0].status).toBe("done");
    // ...and a later change from someone else is not hidden by a stale overlay.
    rerender({ rows: [{ ...A, status: "ongoing" }, B] });
    expect(result.current.rows[0].status).toBe("ongoing");
  });

  it("rolls a failed patch back and says why", async () => {
    const { result } = renderHook(() => useLocalFirst([A, B]));
    const d = deferred(false, "Ditolak.");
    act(() => { void result.current.patch("a", { status: "done" }, d.save); });
    d.resolve();
    await flush();
    expect(result.current.rows[0].status).toBe("todo");
    expect(toast.error).toHaveBeenCalledWith("Ditolak.");
    expect(result.current.status).toBe("error");
  });

  it("a failed older write does not undo a newer edit of the same field", async () => {
    const { result } = renderHook(() => useLocalFirst([A]));
    const first = deferred(false);
    const second = deferred(true);
    act(() => {
      result.current.patch("a", { status: "ongoing" }, first.save);
      result.current.patch("a", { status: "done" }, second.save);
    });
    first.resolve();
    await flush();
    expect(result.current.rows[0].status).toBe("done");
    second.resolve();
    await flush();
    expect(result.current.rows[0].status).toBe("done");
  });

  it("sends writes one after another, in the order they were made", async () => {
    const { result } = renderHook(() => useLocalFirst([A]));
    const first = deferred();
    const second = deferred();
    act(() => {
      result.current.patch("a", { title: "1" }, first.save);
      result.current.patch("a", { title: "2" }, second.save);
    });
    await flush();
    expect(first.save).toHaveBeenCalled();
    expect(second.save).not.toHaveBeenCalled();
    first.resolve();
    await flush();
    expect(second.save).toHaveBeenCalled();
  });

  it("removes at once and restores the row if the delete fails", async () => {
    const { result } = renderHook(() => useLocalFirst([A, B]));
    const d = deferred(false);
    act(() => { void result.current.remove(["a"], d.save); });
    expect(result.current.rows.map((r) => r.id)).toEqual(["b"]);
    d.resolve();
    await flush();
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("adds a row where asked, and never shows it twice once the server has it", async () => {
    const { result, rerender } = renderHook(({ rows }) => useLocalFirst(rows), { initialProps: { rows: [A, B] } });
    const C: Row = { id: "c", title: "A (salinan)", status: "todo" };
    const d = deferred();
    act(() => { void result.current.add(C, d.save, { after: "a" }); });
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "c", "b"]);
    // The server copy can arrive before the action has even replied.
    rerender({ rows: [A, B, C] });
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    d.resolve();
    await flush();
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("drops an added row whose insert failed", async () => {
    const { result } = renderHook(() => useLocalFirst([A]));
    const d = deferred(false);
    act(() => { void result.current.add({ id: "x", title: "X", status: "todo" }, d.save); });
    expect(result.current.rows).toHaveLength(2);
    d.resolve();
    await flush();
    expect(result.current.rows).toHaveLength(1);
  });

  it("shows a new order at once and reverts it on failure", async () => {
    const { result } = renderHook(() => useLocalFirst([A, B]));
    const d = deferred(false);
    act(() => { void result.current.reorder(["b", "a"], d.save); });
    expect(result.current.rows.map((r) => r.id)).toEqual(["b", "a"]);
    d.resolve();
    await flush();
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("a save that throws (network) is retried once, then counts as failed", async () => {
    const save = vi.fn(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useLocalFirst([A]));
    act(() => { void result.current.patch("a", { status: "done" }, save); });
    await flush();
    // Still showing the edit while the retry waits.
    expect(result.current.rows[0].status).toBe("done");
    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    await flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.rows[0].status).toBe("todo");
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/koneksi/));
  });

  it("a save that throws once and then succeeds is kept, with no error", async () => {
    let calls = 0;
    const save = vi.fn(() => (++calls === 1 ? Promise.reject(new Error("blip")) : Promise.resolve({ ok: true })));
    const { result } = renderHook(() => useLocalFirst([A]));
    act(() => { void result.current.patch("a", { status: "done" }, save); });
    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    await flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.rows[0].status).toBe("done");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("an outdated tab (deploy) is announced, not retried and not blamed on the connection", async () => {
    const heard = vi.fn();
    window.addEventListener("ov:stale-build", heard);
    const save = vi.fn(() => Promise.reject(new Error('Server Action "abc123" was not found on the server.')));
    const { result } = renderHook(() => useLocalFirst([A]));
    act(() => { void result.current.patch("a", { status: "done" }, save); });
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalled();
    expect(result.current.rows[0].status).toBe("todo");
    expect(toast.error).not.toHaveBeenCalled();
    window.removeEventListener("ov:stale-build", heard);
  });
  it("change() moves a flag across rows in ONE write and rolls all of it back together", async () => {
    const rows = [{ ...A, status: "main" }, B];
    const { result } = renderHook(() => useLocalFirst(rows));
    const d = deferred(false);
    act(() => {
      void result.current.change(
        [{ id: "a", fields: { status: "todo" } }, { id: "b", fields: { status: "main" } }],
        d.save,
      );
    });
    expect(result.current.rows.map((r) => r.status)).toEqual(["todo", "main"]);
    expect(d.save).toHaveBeenCalledTimes(0);
    await flush();
    expect(d.save).toHaveBeenCalledTimes(1);
    d.resolve();
    await flush();
    expect(result.current.rows.map((r) => r.status)).toEqual(["main", "todo"]);
  });

  it("a reorder can carry a field change that belongs to the same write", async () => {
    const { result } = renderHook(() => useLocalFirst([A, B]));
    const d = deferred(false);
    act(() => {
      void result.current.reorder(["b", "a"], d.save, { changes: [{ id: "a", fields: { title: "Pindah" } }] });
    });
    expect(result.current.rows.map((r) => `${r.id}:${r.title}`)).toEqual(["b:B", "a:Pindah"]);
    d.resolve();
    await flush();
    expect(result.current.rows.map((r) => `${r.id}:${r.title}`)).toEqual(["a:A", "b:B"]);
  });

  it("each write reports whether it succeeded, for callers that need to know", async () => {
    const { result } = renderHook(() => useLocalFirst([A]));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.add({ id: "n", title: "N", status: "todo" }, async () => ({ ok: false, error: "x" }));
    });
    expect(ok).toBe(false);
  });
});
