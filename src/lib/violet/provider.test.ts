import { describe, it, expect } from "vitest";
import { cleanAnswer, classifyThrow } from "./provider";

// ============================================================
// Turning a provider's raw output into something showable.
//
// Both cases here were observed against the real APIs while chasing the outage
// where every Violet question failed: an open-weight model on Groq writing its
// scratchpad into the answer, and a thinking model on Gemini spending its whole
// token allowance before writing anything at all.
// ============================================================

describe("cleanAnswer", () => {
  it("removes a leading reasoning block", () => {
    // Verbatim shape from qwen/qwen3.6-27b on Groq: ask it a one-line factual
    // question and the "answer" opens with its thinking process.
    const raw = "<think>\nHere's a thinking process:\n\n1. Analyse user input\n</think>\n\nTotal anggarannya Rp1.383.000.";
    expect(cleanAnswer(raw)).toBe("Total anggarannya Rp1.383.000.");
  });

  it("leaves an ordinary answer completely alone", () => {
    expect(cleanAnswer("  **Total**: Rp1.383.000.  ")).toBe("**Total**: Rp1.383.000.");
  });

  it("does not touch a block that is not at the start", () => {
    // Mid-text tags are content, not a scratchpad: an answer explaining the
    // markdown or quoting a tag must survive intact.
    const raw = "Tulis begini: <think>contoh</think> selesai.";
    expect(cleanAnswer(raw)).toBe(raw);
  });

  it("leaves an UNCLOSED block alone so the failure stays visible", () => {
    // No closing tag means the model was cut off mid-thought and there is no
    // answer behind it. Stripping would hand back "" and turn a diagnosable
    // failure into a blank bubble; leaving it makes the caller report `empty`.
    const raw = "<think>the model was cut off here";
    expect(cleanAnswer(raw)).toBe(raw);
  });

  it("reports an answer that is only a reasoning block as empty", () => {
    expect(cleanAnswer("<think>only thoughts</think>")).toBe("");
  });
});

describe("classifyThrow", () => {
  it("reads an abort as a timeout, not a network fault", () => {
    const e = new Error("aborted");
    e.name = "TimeoutError";
    expect(classifyThrow(e).code).toBe("timeout");
  });

  it("reads anything else as a network problem", () => {
    expect(classifyThrow(new Error("fetch failed")).code).toBe("network");
  });
});
