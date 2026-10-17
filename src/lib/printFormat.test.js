import { describe, it, expect } from "vitest";
import { parseStoredFormat } from "./printFormat.js";

describe("parseStoredFormat", () => {
  it("keeps a known format", () => {
    expect(parseStoredFormat("fridge")).toBe("fridge");
  });

  it("falls back to shelf tags for anything else", () => {
    for (const raw of [null, "raf", '"fruit"']) expect(parseStoredFormat(raw)).toBe("shelf");
  });
});
