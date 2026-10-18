import { describe, it, expect } from "vitest";
import { eraseDigit, typeDigit } from "./manualCode.js";

describe("typeDigit", () => {
  it("appends a digit", () => {
    expect(typeDigit("", "8")).toBe("8");
  });

  it("ignores anything that isn't a digit", () => {
    expect(typeDigit("12", "a")).toBe("12");
    expect(typeDigit("12", "Enter")).toBe("12");
  });

  it("keeps leading zeros", () => {
    expect(typeDigit("0", "0")).toBe("00");
  });

  it("stops at 20 digits", () => {
    expect(typeDigit("1".repeat(20), "2")).toBe("1".repeat(20));
  });
});

describe("eraseDigit", () => {
  it("removes the last digit", () => {
    expect(eraseDigit("123")).toBe("12");
    expect(eraseDigit("")).toBe("");
  });
});
