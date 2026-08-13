import { describe, it, expect } from "vitest";
import {
  classifyHttp,
  isRetryable,
  shouldFailover,
  violetErrorMessage,
  type VioletErrorCode,
} from "./errors";

describe("classifyHttp", () => {
  it("separates a spent daily quota from going too fast", () => {
    // Both arrive as 429; only the wording tells them apart, and the two need
    // opposite advice ("come back tomorrow" vs "wait a minute").
    expect(
      classifyHttp(429, "You exceeded your current quota, please check your plan and billing details."),
    ).toBe("quota");
    expect(classifyHttp(429, "Rate limit reached for model, limit 30 requests per minute")).toBe(
      "rate_limit",
    );
  });

  it("reads a rejected key as auth, whatever the status", () => {
    expect(classifyHttp(400, "API key not valid. Please pass a valid API key.")).toBe("auth");
    expect(classifyHttp(401, "Invalid Authentication")).toBe("auth");
    expect(classifyHttp(403, "forbidden")).toBe("auth");
  });

  it("reads a retired model and a server fault as unavailable", () => {
    expect(classifyHttp(404, "models/gemini-2.0-flash is not found")).toBe("unavailable");
    expect(classifyHttp(503, "The model is overloaded.")).toBe("unavailable");
  });

  it("falls back to unknown rather than guessing", () => {
    expect(classifyHttp(418, "teapot")).toBe("unknown");
  });
});

describe("copy", () => {
  const ALL: VioletErrorCode[] = [
    "not_configured", "quota", "rate_limit", "auth", "unavailable",
    "timeout", "network", "safety", "empty", "unknown",
  ];

  it("has Indonesian copy for every cause", () => {
    for (const code of ALL) {
      const msg = violetErrorMessage(code);
      expect(msg.length, code).toBeGreaterThan(20);
      // The provider's raw English must never reach the bubble.
      expect(msg).not.toMatch(/quota exceeded|rate limit reached|API key not valid/i);
    }
  });

  it("never offers a retry for something retrying cannot fix", () => {
    expect(isRetryable("quota")).toBe(false);
    expect(isRetryable("auth")).toBe(false);
    expect(isRetryable("not_configured")).toBe(false);
    expect(isRetryable("rate_limit")).toBe(true);
    expect(isRetryable("unavailable")).toBe(true);
  });

  it("does not burn the backup provider on a refusal", () => {
    // A second model would refuse the same question, just more slowly.
    expect(shouldFailover("safety")).toBe(false);
    // These are exactly what the backup provider exists for.
    expect(shouldFailover("quota")).toBe(true);
    expect(shouldFailover("rate_limit")).toBe(true);
    expect(shouldFailover("auth")).toBe(true);
    expect(shouldFailover("not_configured")).toBe(true);
  });
});
