import { describe, it, expect } from "vitest";
import { barcodeCandidates, lookupArticle, lookupProduct, saveProduct } from "./products.js";

// Records every Supabase call the code makes, in order.
const fakeClient = ({ rows = {}, updateResult = { data: [], error: null }, upsertResult = { error: null } } = {}) => {
  const calls = [];
  const client = {
    from: () => ({
      select: () => ({ eq: (_c, val) => ({ maybeSingle: async () => (calls.push(["select", val]), { data: rows[val] ?? null, error: null }) }) }),
      update: (values) => ({ eq: (_c, val) => ({ select: async () => (calls.push(["update", values, val]), updateResult) }) }),
      upsert: async (values) => (calls.push(["upsert", values]), upsertResult),
    }),
  };
  return { client, calls };
};

const majonez = { barcode: "8600005000122", name: "MAJONEZ 175", price: 85 };
const legacyRow = { barcode: "860000500012", name: "MAJONEZ 175", price: 84 };

describe("barcodeCandidates", () => {
  it("adds the 12-digit prefix for a 13-digit code", () => {
    expect(barcodeCandidates("8600005000122")).toEqual(["8600005000122", "860000500012"]);
  });

  it("leaves a code without a check digit or a shorter form alone", () => {
    expect(barcodeCandidates("12345678")).toEqual(["12345678"]); // last digit isn't a check digit
    expect(barcodeCandidates("4006381333931")).toEqual(["4006381333931", "400638133393"]);
  });

  it("tries a typed short code with its check digit added, last", () => {
    // a valid UPC-12 by chance: its 11-digit prefix comes before the full 13 digits
    expect(barcodeCandidates("860000500012")).toEqual(["860000500012", "86000050001", "8600005000122"]);
    expect(barcodeCandidates("8005276")).toEqual(["8005276", "80052760"]);
  });
});

describe("lookupProduct", () => {
  it("falls back to the 12-digit row after the exact code misses", async () => {
    const { client, calls } = fakeClient({ rows: { "860000500012": legacyRow } });
    expect(await lookupProduct("8600005000122", client)).toEqual(legacyRow);
    expect(calls).toEqual([["select", "8600005000122"], ["select", "860000500012"]]);
  });

  it("returns null when no candidate exists", async () => {
    const { client } = fakeClient();
    expect(await lookupProduct("8600005000122", client)).toBeNull();
  });
});

describe("lookupProduct for typed and short codes", () => {
  it("keeps the exact 12-digit row when the full 13-digit one exists too", async () => {
    const { client } = fakeClient({ rows: { "860000500012": legacyRow, "8600005000122": majonez } });
    expect(await lookupProduct("860000500012", client)).toEqual(legacyRow);
  });

  it("finds a stored UPC-A without its check digit before trying a longer code", async () => {
    const upc = { barcode: "03600029145", name: "UPC", price: 10 };
    const { client, calls } = fakeClient({ rows: { "03600029145": upc } });
    expect(await lookupProduct("036000291452", client)).toEqual(upc);
    expect(calls.map(([, code]) => code)).toEqual(["036000291452", "03600029145"]);
  });
});

describe("saveProduct never moves a row to a shorter code", () => {
  it("saves a short code onto the full row it was found under", async () => {
    const { client, calls } = fakeClient();
    await saveProduct({ barcode: "860000500012", name: "MAJONEZ 175", price: 85 }, "8600005000122", client);
    expect(calls).toEqual([["upsert", { barcode: "8600005000122", name: "MAJONEZ 175", price: 85 }]]);
  });
});

describe("saveProduct", () => {
  it("upserts a product that was not found", async () => {
    const { client, calls } = fakeClient();
    await saveProduct(majonez, null, client);
    expect(calls).toEqual([["upsert", majonez]]);
  });

  it("upserts a product found under its own code", async () => {
    const { client, calls } = fakeClient();
    await saveProduct(majonez, "8600005000122", client);
    expect(calls).toEqual([["upsert", majonez]]);
  });

  it("moves a 12-digit row to the full code instead of adding a second row", async () => {
    const { client, calls } = fakeClient({ updateResult: { data: [{ barcode: "8600005000122" }], error: null } });
    await saveProduct(majonez, "860000500012", client);
    expect(calls).toEqual([["update", majonez, "860000500012"]]);
  });

  it("falls back to upsert when the move touches no row", async () => {
    const { client, calls } = fakeClient({ updateResult: { data: [], error: null } });
    await saveProduct(majonez, "860000500012", client);
    expect(calls).toEqual([["update", majonez, "860000500012"], ["upsert", majonez]]);
  });

  it("rejects when the move fails", async () => {
    const { client } = fakeClient({ updateResult: { data: null, error: new Error("boom") } });
    await expect(saveProduct(majonez, "860000500012", client)).rejects.toThrow("boom");
  });
});

describe("lookupArticle (lists, read only)", () => {
  it("finds the full 13-digit row when only 12 digits were typed", async () => {
    const { client, calls } = fakeClient({ rows: { "8600005000122": majonez } });
    expect(await lookupArticle("860000500012", client)).toEqual(majonez);
    expect(calls).toEqual([["select", "860000500012"], ["select", "8600005000122"]]);
  });

  it("finds the 12-digit row for a scanned code, like the price tags do", async () => {
    const { client } = fakeClient({ rows: { "860000500012": legacyRow } });
    expect(await lookupArticle("8600005000122", client)).toEqual(legacyRow);
  });
});

describe("barcodes of any length", () => {
  it("finds an EAN-8 article stored without its check digit (Kinder Bueno)", async () => {
    const bueno = { barcode: "8005276", name: "KINDER BUENO", price: 129.99 };
    const { client, calls } = fakeClient({ rows: { "8005276": bueno } });
    expect(barcodeCandidates("80052760")).toEqual(["80052760", "8005276"]);
    expect(await lookupProduct("80052760", client)).toEqual(bueno);
    expect(calls).toEqual([["select", "80052760"], ["select", "8005276"]]);
  });

  it("doesn't guess a prefix for a code whose last digit isn't a check digit", () => {
    expect(barcodeCandidates("80052761")).toEqual(["80052761"]);
  });

  it("moves the 7-digit row to the full scanned code when saved", async () => {
    const { client, calls } = fakeClient({ updateResult: { data: [{ barcode: "80052760" }], error: null } });
    await saveProduct({ barcode: "80052760", name: "KINDER BUENO", price: 129.99 }, "8005276", client);
    expect(calls).toEqual([["update", { barcode: "80052760", name: "KINDER BUENO", price: 129.99 }, "8005276"]]);
  });
});
