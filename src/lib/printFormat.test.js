import { describe, it, expect } from "vitest";
import { PRINT_FORMATS, parseStoredFormat, tagFormatOf } from "./printFormat.js";

describe("parseStoredFormat", () => {
  it("keeps a known format", () => {
    expect(parseStoredFormat("fridge")).toBe("fridge");
  });

  it("falls back to shelf tags for anything else", () => {
    for (const raw of [null, "raf", '"fruit"']) expect(parseStoredFormat(raw)).toBe("shelf");
  });
});

describe("Mix", () => {
  it("is a format of its own on the preview", () => {
    expect(PRINT_FORMATS).toEqual(["shelf", "fridge", "fruit", "mix"]);
    expect(parseStoredFormat("mix")).toBe("mix");
  });

  it("draws a tag in the item's own Mix choice, shelf until it has one", () => {
    expect(tagFormatOf("mix", "fridge")).toBe("fridge");
    expect(tagFormatOf("mix", undefined)).toBe("shelf");
    expect(tagFormatOf("fruit", "fridge")).toBe("fruit");
  });
});
