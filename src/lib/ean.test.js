import { describe, it, expect } from "vitest";
import { eanCheckDigitOk, sameArticleCodes, withCheckDigit } from "./ean.js";

describe("EAN check digit", () => {
  it("accepts valid EAN-13 and EAN-8 codes and refuses wrong ones", () => {
    expect(eanCheckDigitOk("4006381333931")).toBe(true);
    expect(eanCheckDigitOk("4006381333932")).toBe(false);
    expect(eanCheckDigitOk("96385074")).toBe(true);
  });

  it("completes the 12 digits the POS export kept", () => {
    expect(withCheckDigit("400638133393")).toBe("4006381333931");
    expect(withCheckDigit("860000500010")).toBe("8600005000108");
  });
});

describe("sameArticleCodes", () => {
  it("pairs a full EAN-13 with the 12 digits stored without its check digit", () => {
    expect(sameArticleCodes("4006381333931")).toEqual(["4006381333931", "400638133393"]);
    expect(sameArticleCodes("400638133393")).toEqual(["400638133393", "4006381333931"]);
  });

  it("matches other codes only exactly", () => {
    expect(sameArticleCodes("4006381333932")).toEqual(["4006381333932"]);
    expect(sameArticleCodes("12345")).toEqual(["12345"]);
  });
});
