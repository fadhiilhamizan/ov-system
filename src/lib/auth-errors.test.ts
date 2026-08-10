import { describe, it, expect } from "vitest";
import { authErrorMessage } from "./auth-errors";

// ------------------------------------------------------------------
// The bug this guards: supabase/auth-js falls back to JSON.stringify(body)
// when the Auth server's error body has no msg/message/error_description/error
// field, so a GoTrue 500 reached the login form as the literal string "{}".
// ------------------------------------------------------------------
describe("authErrorMessage", () => {
  it("never returns the bare '{}' the login page used to show", () => {
    const msg = authErrorMessage({ message: "{}", status: 500 });
    expect(msg).not.toBe("{}");
    expect(msg).toContain("500");
  });

  it("replaces any message that is only a JSON blob", () => {
    for (const raw of ["{}", "[]", '{"foo":1}', "  { }  ", '[{"a":1}]']) {
      expect(authErrorMessage({ message: raw })).not.toBe(raw);
      expect(authErrorMessage({ message: raw }).length).toBeGreaterThan(20);
    }
  });

  it("passes a real server message through untouched", () => {
    expect(authErrorMessage({ message: "Invalid login credentials", status: 400 }))
      .toBe("Invalid login credentials");
    expect(authErrorMessage({ message: "Email not confirmed" }))
      .toBe("Email not confirmed");
  });

  it("does not mistake ordinary prose containing braces for a blob", () => {
    // Only a message that is ENTIRELY a JSON blob is unreadable; one that
    // merely mentions braces is still the server talking.
    const m = "Password must not contain {} characters";
    expect(authErrorMessage({ message: m })).toBe(m);
  });

  it("handles a missing, empty, or null error object", () => {
    for (const e of [null, undefined, {}, { message: "" }, { message: null }]) {
      expect(authErrorMessage(e).length).toBeGreaterThan(20);
    }
  });

  it("distinguishes a server fault from a plain rejected login", () => {
    expect(authErrorMessage({ message: "{}", status: 500 })).toContain("Server autentikasi");
    expect(authErrorMessage({ message: "{}", status: 400 })).toContain("email & kata sandi");
  });
});
