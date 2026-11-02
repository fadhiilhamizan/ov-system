import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteButton } from "./delete-button";

// The rundown, FGD, Compare and comment bins used to delete on ONE click.
// These pin the replacement: the first click only asks, and every way out
// of the question (cross, Escape, a click elsewhere) keeps the row.

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <div>
      <DeleteButton size="sm" side="left" label="Hapus baris" onConfirm={onConfirm} onCancel={onCancel} />
      <button type="button">elsewhere</button>
    </div>,
  );
  return { onConfirm, onCancel, bin: screen.getByRole("button", { name: "Hapus baris" }) };
}

describe("DeleteButton", () => {
  it("does not delete on the first click, it asks", () => {
    const { onConfirm, bin } = setup();
    fireEvent.click(bin);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(bin.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Ya, hapus" })).toBeTruthy();
  });

  it("deletes once the tick is pressed", () => {
    const { onConfirm, onCancel, bin } = setup();
    fireEvent.click(bin);
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(bin.getAttribute("aria-expanded")).toBe("false");
  });

  it("backs out with the cross", () => {
    const { onConfirm, onCancel, bin } = setup();
    fireEvent.click(bin);
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("backs out on Escape without the key reaching the page shortcuts", () => {
    // keyboard-shortcuts.tsx listens on window; a bulk bar's Escape lives there.
    const page = vi.fn();
    window.addEventListener("keydown", page);
    try {
      const { onConfirm, onCancel, bin } = setup();
      fireEvent.click(bin);
      fireEvent.keyDown(screen.getByRole("button", { name: "Ya, hapus" }), { key: "Escape" });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
      expect(page).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", page);
    }
  });

  it("lets Escape through when it is closed", () => {
    const page = vi.fn();
    window.addEventListener("keydown", page);
    try {
      const { bin } = setup();
      fireEvent.keyDown(bin, { key: "Escape" });
      expect(page).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("keydown", page);
    }
  });

  it("backs out when you click somewhere else", () => {
    const { onConfirm, onCancel, bin } = setup();
    fireEvent.click(bin);
    fireEvent.pointerDown(screen.getByRole("button", { name: "elsewhere" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(bin.getAttribute("aria-expanded")).toBe("false");
  });
});
