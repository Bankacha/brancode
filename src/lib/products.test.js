import { describe, it, expect } from "vitest";
import { barcodeCandidates, lookupProduct, saveProduct } from "./products.js";

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

  it("leaves other lengths alone", () => {
    expect(barcodeCandidates("12345678")).toEqual(["12345678"]);
    expect(barcodeCandidates("860000500012")).toEqual(["860000500012"]);
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
