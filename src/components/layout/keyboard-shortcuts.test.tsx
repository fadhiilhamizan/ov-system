import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ============================================================
// The global keydown handler: page keys reach the element that declares them,
// typing is never hijacked, "g" + letter navigates, and Ctrl+Enter never
// presses Batal when the save button is still disabled.
// ============================================================

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));
vi.mock("@/lib/actions/session", () => ({ setLang: vi.fn() }));
vi.mock("@/lib/i18n/provider", () => ({ useT: () => (s: string) => s, useLang: () => "id" }));

const { KeyboardShortcuts } = await import("./keyboard-shortcuts");

// jsdom has no layout, so every element measures 0x0 and would count as
// hidden. Give them all a size.
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
});

function Page({ onAdd = vi.fn(), onSearch }: { onAdd?: () => void; onSearch?: () => void }) {
  return (
    <>
      <KeyboardShortcuts allowedNav={["dashboard", "tasks"]} onToggleSidebar={vi.fn()} />
      <main>
        <input aria-label="Cari" aria-keyshortcuts="/" onFocus={onSearch} />
        <button aria-keyshortcuts="N" onClick={onAdd}>Tambah</button>
        <table>
          <tbody>
            <tr><td><input type="checkbox" aria-label="Pilih 1" /></td><td><button>Satu</button></td></tr>
            <tr><td><input type="checkbox" aria-label="Pilih 2" /></td><td><button>Dua</button></td></tr>
          </tbody>
        </table>
      </main>
    </>
  );
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  act(() => { fireEvent.keyDown(target, { key, ...init }); });

describe("KeyboardShortcuts", () => {
  it("presses the element whose aria-keyshortcuts matches", () => {
    const onAdd = vi.fn();
    render(<Page onAdd={onAdd} />);
    press("n");
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("leaves letters alone while the person is typing", () => {
    const onAdd = vi.fn();
    render(<Page onAdd={onAdd} />);
    const box = screen.getByLabelText("Cari");
    box.focus();
    press("n", {}, box);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("'/' focuses the page's own search box", () => {
    render(<Page />);
    press("/");
    expect(document.activeElement).toBe(screen.getByLabelText("Cari"));
  });

  it("'g' then a letter opens that menu, if the account may", () => {
    render(<Page />);
    press("g");
    press("w");
    expect(push).toHaveBeenCalledWith("/tasks");
    push.mockClear();
    press("g");
    press("s"); // settings: not in allowedNav
    expect(push).not.toHaveBeenCalled();
  });

  it("j / k walk the table rows and x ticks the focused one", () => {
    render(<Page />);
    press("j");
    expect(document.activeElement).toBe(screen.getByLabelText("Pilih 1"));
    press("j", {}, document.activeElement!);
    expect(document.activeElement).toBe(screen.getByLabelText("Pilih 2"));
    press("x", {}, document.activeElement!);
    expect((screen.getByLabelText("Pilih 2") as HTMLInputElement).checked).toBe(true);
    press("k", {}, document.activeElement!);
    expect(document.activeElement).toBe(screen.getByLabelText("Pilih 1"));
  });

  it("Ctrl+Enter presses the save button, and never Batal when save is disabled", () => {
    const save = vi.fn();
    const cancel = vi.fn();
    const { rerender } = render(
      <div role="dialog">
        <KeyboardShortcuts allowedNav={[]} onToggleSidebar={vi.fn()} />
        <input aria-label="Judul" />
        <div data-dialog-footer="">
          <button onClick={cancel}>Batal</button>
          <button onClick={save} disabled>Simpan</button>
        </div>
      </div>,
    );
    const field = screen.getByLabelText("Judul");
    press("Enter", { ctrlKey: true }, field);
    expect(save).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    rerender(
      <div role="dialog">
        <KeyboardShortcuts allowedNav={[]} onToggleSidebar={vi.fn()} />
        <input aria-label="Judul" />
        <div data-dialog-footer="">
          <button onClick={cancel}>Batal</button>
          <button onClick={save}>Simpan</button>
        </div>
      </div>,
    );
    press("Enter", { ctrlKey: true }, screen.getByLabelText("Judul"));
    expect(save).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("'?' opens the shortcut list", () => {
    render(<Page />);
    press("?", { shiftKey: true });
    expect(screen.getByText("Pintasan Keyboard")).toBeTruthy();
  });
});
