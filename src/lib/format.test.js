import { describe, it, expect } from "vitest";
import { formatPrice } from "./format.js";

describe("formatPrice", () => {
  it("prints two decimals with a decimal comma", () => {
    expect(formatPrice(219)).toBe("219,00");
  });

  it("groups thousands with a dot", () => {
    expect(formatPrice(1249.99)).toBe("1.249,99");
    expect(formatPrice(12499.9)).toBe("12.499,90");
  });
});
