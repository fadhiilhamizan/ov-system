import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./avatar";
import { CHARACTER_KEYS, CHARACTER_LABEL, CharacterAvatar } from "./character-avatar";

// ============================================================
// Avatar picks between initials and a character.
//
// The branch lives in ONE component on purpose, because an avatar is rendered
// in a dozen places (topbar, task comments, PIC picker, inbox) and "some of
// them honour the chosen character and some don't" is a bug that only ever
// shows up one screen at a time. These tests are what stop somebody reading
// `profiles.avatar` at a new call site and forgetting another.
// ============================================================

describe("Avatar", () => {
  it("falls back to initials when no character is chosen", () => {
    render(<Avatar name="Dona Ayu" />);
    expect(screen.getByText("DA")).toBeTruthy();
  });

  it("renders the chosen character instead of initials", () => {
    const { container } = render(<Avatar name="Dona Ayu" character="panda" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("DA")).toBeNull();
  });

  it("names the character after the person, so it is not read as decoration", () => {
    // The image carries the person's name, which is what a screen reader
    // announces. An unnamed circle next to a name already on screen would
    // just be noise.
    render(<Avatar name="Dona Ayu" character="rubah" />);
    expect(screen.getByRole("img", { name: "Dona Ayu" })).toBeTruthy();
  });

  it("ignores a character key that does not exist", () => {
    // The key comes from the database. A value written by an older or newer
    // version of the app must degrade to initials, never to an empty circle.
    render(<Avatar name="Dona Ayu" character="naga" />);
    expect(screen.getByText("DA")).toBeTruthy();
  });

  it("ignores null and empty, which is how 'back to my initials' is stored", () => {
    const { rerender } = render(<Avatar name="Dona Ayu" character={null} />);
    expect(screen.getByText("DA")).toBeTruthy();
    rerender(<Avatar name="Dona Ayu" character="" />);
    expect(screen.getByText("DA")).toBeTruthy();
  });
});

describe("the five characters", () => {
  it("offers exactly five, each with a name", () => {
    // Five is the number the feature was asked for, and the keys are stored in
    // the database - renaming one silently changes somebody's picture.
    expect(CHARACTER_KEYS).toEqual(["rubah", "panda", "burung", "kucing", "beruang"]);
    for (const k of CHARACTER_KEYS) expect(CHARACTER_LABEL[k]).toBeTruthy();
  });

  it("draws every one of them", () => {
    for (const k of CHARACTER_KEYS) {
      const { container, unmount } = render(<CharacterAvatar character={k} title={k} />);
      const svg = container.querySelector("svg");
      expect(svg, k).not.toBeNull();
      // Something actually drawn, not an empty frame.
      expect(svg!.children.length, k).toBeGreaterThan(1);
      unmount();
    }
  });

  it("gives each character its own background, so they read apart at 28px", () => {
    const colours = CHARACTER_KEYS.map((k) => {
      const { container, unmount } = render(<CharacterAvatar character={k} />);
      const bg = (container.querySelector("svg") as SVGElement).style.backgroundColor;
      unmount();
      return bg;
    });
    expect(new Set(colours).size).toBe(CHARACTER_KEYS.length);
  });
});
