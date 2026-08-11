import { describe, it, expect } from "vitest";
import { checkNewPassword, MIN_PASSWORD } from "./password";

describe("checkNewPassword", () => {
  it("accepts a valid new password", () => {
    expect(checkNewPassword("rahasia123", "rahasia123").ok).toBe(true);
  });

  it("rejects anything shorter than the minimum", () => {
    const r = checkNewPassword("pendek", "pendek");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(String(MIN_PASSWORD));
    // Exactly at the boundary is allowed.
    expect(checkNewPassword("a".repeat(MIN_PASSWORD), "a".repeat(MIN_PASSWORD)).ok).toBe(true);
    expect(checkNewPassword("a".repeat(MIN_PASSWORD - 1), "a".repeat(MIN_PASSWORD - 1)).ok).toBe(false);
  });

  it("rejects a mismatched confirmation", () => {
    const r = checkNewPassword("rahasia123", "rahasia124");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("tidak cocok");
  });

  it("rejects reusing the current password", () => {
    // Otherwise a "successful" change that changed nothing looks like a bug.
    const r = checkNewPassword("rahasia123", "rahasia123", "rahasia123");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("berbeda");
  });

  it("ignores the reuse rule when no current password is supplied (signup)", () => {
    expect(checkNewPassword("rahasia123", "rahasia123", undefined).ok).toBe(true);
    expect(checkNewPassword("rahasia123", "rahasia123", "").ok).toBe(true);
  });

  it("checks length before mismatch, so the clearer error wins", () => {
    const r = checkNewPassword("abc", "xyz");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("minimal");
  });
});
