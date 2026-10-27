import { describe, it, expect } from "vitest";
import { eanCheckDigitOk, fullCodeOf, gtinCheckDigitOk, sameArticleCodes, withCheckDigit, withoutCheckDigit } from "./ean.js";

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

describe("any length (the POS export drops the check digit of every GTIN)", () => {
  it("checks GTIN-8, -12, -13 and -14 the same way", () => {
    for (const code of ["80052760", "42123880", "4006381333931", "036000291452", "14006381333938"]) expect(gtinCheckDigitOk(code)).toBe(true);
    for (const code of ["80052761", "4006381333932", "8005276", "12345"]) expect(gtinCheckDigitOk(code)).toBe(false);
  });

  it("drops a valid check digit, and only a valid one", () => {
    expect(withoutCheckDigit("80052760")).toBe("8005276");
    expect(withoutCheckDigit("80052761")).toBeNull();
    expect(withoutCheckDigit("8005276")).toBeNull();
    expect(withCheckDigit("8005276")).toBe("80052760");
  });

  it("matches a scanned EAN-8 with the 7 digits stored, both ways (Kinder Bueno)", () => {
    expect(sameArticleCodes("80052760")).toEqual(["80052760", "8005276"]);
    expect(sameArticleCodes("8005276")).toEqual(["8005276", "80052760"]);
  });

  it("still pairs 12 and 13 digits first, and tries nothing else for short codes", () => {
    expect(sameArticleCodes("400638133393").slice(0, 2)).toEqual(["400638133393", "4006381333931"]);
    expect(sameArticleCodes("12345")).toEqual(["12345"]);
  });
});

describe("fullCodeOf", () => {
  it("takes the full code found for a typed code without its check digit", () => {
    expect(fullCodeOf("8005276", "80052760")).toBe("80052760");
    expect(fullCodeOf("860000500012", "8600005000122")).toBe("8600005000122");
  });

  it("keeps the typed code otherwise", () => {
    expect(fullCodeOf("860000500012", "860000500012")).toBe("860000500012");
    expect(fullCodeOf("8005276", undefined)).toBe("8005276");
    expect(fullCodeOf("4006381333931", "40063813339310")).toBe("4006381333931");
  });
});
