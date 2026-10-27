import { describe, it, expect } from "vitest";
import { readTagFormats, saveTagFormats } from "./tagFormats.js";

// Records every chained call and answers each awaited query with the next
// prepared result (as in inventories.test.js).
const fakeClient = (...results) => {
  const calls = [];
  const next = () => results.shift() ?? { data: [], error: null };
  const from = (table) => {
    const query = { table, steps: [] };
    calls.push(query);
    const chain = new Proxy(
      {},
      {
        get: (_, method) => {
          if (method === "then") return (resolve, reject) => Promise.resolve(next()).then(resolve, reject);
          return (...args) => {
            query.steps.push([method, ...args]);
            return chain;
          };
        },
      }
    );
    return chain;
  };
  return { calls, from };
};
const step = (call, method) => call.steps.find(([m]) => m === method);

describe("readTagFormats", () => {
  it("finds the format of an article whose row has 12 digits for a 13-digit code on the list", async () => {
    const client = fakeClient({ data: [{ barcode: "860000500012", tag_format: "fridge" }], error: null });
    const formats = await readTagFormats(["8600005000122"], client);
    expect(step(client.calls[0], "in")).toEqual(["in", "barcode", ["8600005000122", "860000500012"]]);
    expect(formats.get("8600005000122")).toEqual({ dbBarcode: "860000500012", format: "fridge" });
  });

  it("prefers the exact code when both rows exist, and leaves out articles not in the database", async () => {
    const client = fakeClient({
      data: [
        { barcode: "860000500012", tag_format: "shelf" },
        { barcode: "8600005000122", tag_format: null },
      ],
      error: null,
    });
    const formats = await readTagFormats(["8600005000122", "4006381333931"], client);
    expect(formats.get("8600005000122")).toEqual({ dbBarcode: "8600005000122", format: null });
    expect(formats.has("4006381333931")).toBe(false);
  });

  it("asks in batches of 100 codes", async () => {
    const client = fakeClient();
    await readTagFormats(Array.from({ length: 250 }, (_, i) => `A${i}`), client);
    expect(client.calls.map((call) => step(call, "in")[2].length)).toEqual([100, 100, 50]);
  });

  it("throws what Supabase reports", async () => {
    const client = fakeClient({ data: null, error: new Error("offline") });
    await expect(readTagFormats(["1"], client)).rejects.toThrow("offline");
  });
});

describe("saveTagFormats", () => {
  it("writes only the format column, one update per format", async () => {
    const client = fakeClient();
    await saveTagFormats(
      [
        { dbBarcode: "1", format: "fridge" },
        { dbBarcode: "2", format: "shelf" },
        { dbBarcode: "3", format: "fridge" },
      ],
      client
    );
    expect(client.calls.map((call) => [step(call, "update")[1], step(call, "in")[2]])).toEqual([
      [{ tag_format: "fridge" }, ["1", "3"]],
      [{ tag_format: "shelf" }, ["2"]],
    ]);
    expect(client.calls.every((call) => call.table === "products")).toBe(true);
  });

  it("throws what Supabase reports", async () => {
    const client = fakeClient({ data: null, error: new Error("offline") });
    await expect(saveTagFormats([{ dbBarcode: "1", format: "shelf" }], client)).rejects.toThrow("offline");
  });
});
