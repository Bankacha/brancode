import { describe, it, expect } from "vitest";
import { plural } from "./plural.js";

const a = (n) => plural(n, "artikal", "artikla", "artikala");

describe("plural", () => {
  it("uses the singular form for 1 and numbers ending in 1 except 11", () => {
    expect(a(1)).toBe("artikal");
    expect(a(21)).toBe("artikal");
  });

  it("uses the paucal form for 2–4 and numbers ending in 2–4 except 12–14", () => {
    expect(a(2)).toBe("artikla");
    expect(a(4)).toBe("artikla");
    expect(a(22)).toBe("artikla");
    expect(a(42)).toBe("artikla");
  });

  it("uses the plural form for 0, 5–20 and the teens", () => {
    for (const n of [0, 5, 11, 12, 14, 111]) expect(a(n)).toBe("artikala");
  });

  it("works for verbs agreeing with the count", () => {
    expect(plural(1, "traži", "traže", "traže")).toBe("traži");
    expect(plural(2, "traži", "traže", "traže")).toBe("traže");
  });
});
