import { describe, it, expect } from "vitest";
import { formatPrice, parsePrice, toPriceInput } from "./format.js";

describe("formatPrice", () => {
  it("prints two decimals with a decimal comma", () => {
    expect(formatPrice(219)).toBe("219,00");
  });

  it("groups thousands with a dot", () => {
    expect(formatPrice(1249.99)).toBe("1.249,99");
    expect(formatPrice(12499.9)).toBe("12.499,90");
  });
});

describe("parsePrice", () => {
  it("reads a positive price with a decimal comma or dot", () => {
    expect(parsePrice("79")).toBe(79);
    expect(parsePrice(" 84,5 ")).toBe(84.5);
    expect(parsePrice("1249.99")).toBe(1249.99);
  });

  it("rejects empty, non-numeric, zero, negative and grouped input", () => {
    for (const text of ["", "0", "-5", "abc", "1.249,99"]) expect(parsePrice(text)).toBeNull();
  });
});

describe("toPriceInput", () => {
  it("prefills the price field with a decimal comma", () => {
    expect(toPriceInput(1249.99)).toBe("1249,99");
    expect(toPriceInput(84)).toBe("84");
  });
});
