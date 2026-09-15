import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Member } from "@/lib/types";
import { MemberPicker } from "./member-picker";

// ============================================================
// The PIC picker.
//
// The bug this pins: the Work Breakdown task form narrowed the list to the
// task's division and left it there, so anyone the roster did not have in that
// division was not merely sorted lower, they were unpickable. Whatever puts the
// roster in that state - a division field never filled in, a person genuinely
// helping another division - the answer is the same: assigning a task to
// somebody is not something the app gets to refuse.
//
// So the division's own people still come first, under their role headings,
// and everyone else is reachable below and through the search box.
// ============================================================

vi.mock("@/lib/i18n/provider", () => ({ useT: () => (s: string) => s }));

const m = (over: Partial<Member>): Member => ({
  id: "m1", name: "Budi Santoso", nickname: "Budi", nrp: "5026231001",
  type: "fungsionaris", year: 2023, divisions: ["LO"], ...over,
});

const aul = m({ id: "a", name: "Auliya Malika", nickname: "Aul" });
const dani = m({ id: "d", name: "Muhammad Daniel", nickname: "Daniel" });
const mega = m({ id: "g", name: "Mega Agustina", nickname: "Mega", divisions: ["EVENT"] });
const rina = m({ id: "n", name: "Nisrina Kamiliya", nickname: "Nisrina", type: "intern", divisions: [] });

const onChange = vi.fn();

function open(extra?: { label: string; members: Member[] }, value = "") {
  render(
    <MemberPicker
      members={[aul, dani]}
      value={value}
      onChange={onChange}
      roleOf={(x) => (x.nickname === "Aul" ? "coordinator" : x.type)}
      extra={extra}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Pilih anggota/ }));
}

const others = { label: "Anggota divisi lain", members: [mega, rina] };

beforeEach(() => { vi.clearAllMocks(); });

describe("MemberPicker", () => {
  it("groups the division's own members under their role", () => {
    open();
    expect(screen.getByText("Koordinator")).toBeTruthy();
    expect(screen.getByText("Aul")).toBeTruthy();
    expect(screen.getByText("Daniel")).toBeTruthy();
  });

  it("still offers everyone else, under their own heading", () => {
    open(others);
    expect(screen.getByText("Anggota divisi lain")).toBeTruthy();
    // Mega is in another division, Nisrina has no division at all. Before the
    // fix neither could be named as PIC from this dialog.
    expect(screen.getByText("Mega")).toBeTruthy();
    expect(screen.getByText("Nisrina")).toBeTruthy();
  });

  it("can select someone from the second section", () => {
    open(others);
    fireEvent.click(screen.getByText("Mega"));
    expect(onChange).toHaveBeenCalledWith("Mega");
  });

  it("searches both sections", () => {
    open(others);
    fireEvent.change(screen.getByPlaceholderText("Cari nama / NRP…"), {
      target: { value: "nisrina" },
    });
    expect(screen.getByText("Nisrina")).toBeTruthy();
    expect(screen.queryByText("Daniel")).toBeNull();
  });

  it("says nothing matched only when BOTH sections are empty", () => {
    open(others);
    fireEvent.change(screen.getByPlaceholderText("Cari nama / NRP…"), {
      target: { value: "mega" },
    });
    // The first section is empty here, but Mega is in the second one - the
    // empty state would be a lie.
    expect(screen.queryByText("Tidak ada anggota yang cocok.")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Cari nama / NRP…"), {
      target: { value: "zzzz" },
    });
    expect(screen.getByText("Tidak ada anggota yang cocok.")).toBeTruthy();
  });

  it("treats a name from the second section as known, not as free text", () => {
    // An unknown token renders as a muted "extra" chip meaning "this is not
    // anybody on the roster". Someone picked from the second section IS on the
    // roster, so labelling them that way would be wrong.
    const { container } = render(
      <MemberPicker members={[aul, dani]} value="Mega" onChange={onChange} extra={others} />,
    );
    const chip = [...container.querySelectorAll("span")].find((el) => el.textContent === "Mega");
    expect(chip?.className).toContain("bg-accent");
    expect(chip?.className).not.toContain("bg-muted");
  });
});
