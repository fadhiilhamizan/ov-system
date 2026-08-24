import { describe, expect, it } from "vitest";
import { isKnownBenignError } from "./session-beacons";

describe("isKnownBenignError", () => {
  it("matches the Firefox phrasing for a null parentNode read", () => {
    expect(isKnownBenignError('can\'t access property "parentNode", b is null')).toBe(true);
  });

  it("matches the V8/Chrome phrasing for a null parentNode read", () => {
    expect(isKnownBenignError("Cannot read properties of null (reading 'parentNode')")).toBe(true);
  });

  it("matches the Safari/JSC phrasing for a null parentNode read", () => {
    expect(isKnownBenignError("null is not an object (evaluating 'b.parentNode')")).toBe(true);
  });

  it("does not match an unrelated null-read error", () => {
    expect(isKnownBenignError("Cannot read properties of null (reading 'value')")).toBe(false);
  });

  it("does not match a parentNode mention that is not a null read", () => {
    expect(isKnownBenignError("node.parentNode is not an Element")).toBe(false);
  });

  it("does not match an empty message", () => {
    expect(isKnownBenignError("")).toBe(false);
  });
});
