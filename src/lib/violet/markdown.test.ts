import { describe, it, expect } from "vitest";
import { inlineText, parseInline, parseMarkdown, toPlainText, type Block } from "./markdown";

const text = (s: string) => ({ type: "text", text: s });
const bold = (s: string) => ({ type: "bold", children: [text(s)] });

describe("parseInline", () => {
  it("reads bold", () => {
    expect(parseInline("Halo **Violet** apa kabar")).toEqual([
      text("Halo "),
      bold("Violet"),
      text(" apa kabar"),
    ]);
  });

  it("reads __bold__ and _italic_", () => {
    expect(parseInline("__tebal__ dan _miring_")).toEqual([
      bold("tebal"),
      text(" dan "),
      { type: "italic", children: [text("miring")] },
    ]);
  });

  it("prefers bold over italic on a double marker", () => {
    // "**x**" must not parse as an empty italic wrapping "x".
    expect(parseInline("**x**")).toEqual([bold("x")]);
  });

  it("parses a link INSIDE bold", () => {
    // Seen in a real answer: "**[Work Breakdown](/tasks)**". Treating the
    // inside of bold as flat text printed the brackets and the raw path.
    expect(parseInline("**[Work Breakdown](/tasks)**")).toEqual([
      { type: "bold", children: [{ type: "link", text: "Work Breakdown", href: "/tasks" }] },
    ]);
  });

  it("leaves a lone asterisk alone", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([text("2 * 3 = 6")]);
  });

  it("keeps markers inside inline code literal", () => {
    expect(parseInline("pakai `a**b`")).toEqual([
      text("pakai "),
      { type: "code", text: "a**b" },
    ]);
  });

  it("reads a link and falls back to the href as its label", () => {
    expect(parseInline("buka [Pengaturan](/settings#changelog)")).toEqual([
      text("buka "),
      { type: "link", text: "Pengaturan", href: "/settings#changelog" },
    ]);
    expect(parseInline("[](/faq)")).toEqual([{ type: "link", text: "/faq", href: "/faq" }]);
  });
});

describe("parseMarkdown", () => {
  it("groups hard-wrapped prose into one paragraph", () => {
    const blocks = parseMarkdown("baris satu\nbaris dua\n\nparagraf lain");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: "para", inline: [text("baris satu baris dua")] });
  });

  it("reads a bullet list written with any marker", () => {
    const blocks = parseMarkdown("- satu\n* dua\n• tiga");
    expect(blocks).toHaveLength(1);
    const b = blocks[0] as Extract<Block, { type: "bullets" }>;
    expect(b.type).toBe("bullets");
    expect(b.items.map(inlineText)).toEqual(["satu", "dua", "tiga"]);
  });

  it("reads a numbered list and keeps its starting number", () => {
    const blocks = parseMarkdown("3. tiga\n4. empat");
    const b = blocks[0] as Extract<Block, { type: "ordered" }>;
    expect(b.type).toBe("ordered");
    expect(b.start).toBe(3);
    expect(b.items).toHaveLength(2);
  });

  it("reads headings, quotes and rules", () => {
    const blocks = parseMarkdown("## Judul\n> catatan\n\n---");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "quote", "rule"]);
    expect((blocks[0] as Extract<Block, { type: "heading" }>).level).toBe(2);
  });

  it("reads a fenced code block, terminated or not", () => {
    expect(parseMarkdown("```\nnpm run dev\n```")).toEqual([
      { type: "code", text: "npm run dev" },
    ]);
    // An unterminated fence must not swallow the answer.
    expect(parseMarkdown("```\nhalo")).toEqual([{ type: "code", text: "halo" }]);
  });

  it("survives empty and whitespace input", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("   \n\n ")).toEqual([]);
  });

  it("parses the shape of a real Violet answer", () => {
    const answer = [
      "Halo! Saya **Violet**. Saya bisa membantu:",
      "",
      "1. **Tanya jawab**: menjelaskan cara pakai sistem.",
      "2. **Navigasi**: membuka menu yang kamu maksud.",
      "",
      "Catatan:",
      "- Enter untuk mengirim pesan",
      "- Shift+Enter untuk baris baru",
    ].join("\n");
    expect(parseMarkdown(answer).map((b) => b.type)).toEqual([
      "para",
      "ordered",
      "para",
      "bullets",
    ]);
  });
});

describe("toPlainText", () => {
  it("strips the markers for the clipboard", () => {
    expect(toPlainText("Halo **Violet**\n\n- satu\n- dua")).toBe("Halo Violet\n\n- satu\n- dua");
  });

  it("flattens nested emphasis", () => {
    expect(toPlainText("**[Work Breakdown](/tasks)** penting")).toBe("Work Breakdown penting");
  });
});
