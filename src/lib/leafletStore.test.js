import { describe, it, expect } from "vitest";
import { createLeafletStore } from "./leafletStore.js";

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

const leafletRow = {
  id: "L1",
  name: "Jutro Liflet Avg",
  date_from: "2026-09-25",
  date_to: "2026-10-31",
  prices_applied_at: "2026-09-26T08:00:00Z",
  prices_restored_at: null,
  reminded_tomorrow_at: null,
  reminded_today_at: null,
};

describe("leaflet store", () => {
  it("reads the leaflets whose prices haven't been restored, in camelCase", async () => {
    const client = fakeClient({ data: [leafletRow], error: null });
    const leaflets = await createLeafletStore(client).openLeaflets();
    expect(client.calls[0].table).toBe("promo_leaflets");
    expect(client.calls[0].steps).toContainEqual(["is", "prices_restored_at", null]);
    expect(leaflets).toEqual([
      {
        id: "L1",
        name: "Jutro Liflet Avg",
        dateFrom: "2026-09-25",
        dateTo: "2026-10-31",
        pricesAppliedAt: "2026-09-26T08:00:00Z",
        pricesRestoredAt: null,
        remindedTomorrowAt: null,
        remindedTodayAt: null,
      },
    ]);
  });

  it("asks for products in batches of 100 barcodes", async () => {
    const client = fakeClient();
    const barcodes = Array.from({ length: 250 }, (_, i) => String(i));
    await createLeafletStore(client).products(barcodes);
    expect(client.calls.map((call) => call.steps.find(([method]) => method === "in")[2].length)).toEqual([100, 100, 50]);
  });

  it("saves a leaflet once per name and period", async () => {
    const client = fakeClient({ data: leafletRow, error: null });
    const saved = await createLeafletStore(client).saveLeaflet({ name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31" });
    expect(client.calls[0].steps[0]).toEqual(["upsert", { name: "Jutro Liflet Avg", date_from: "2026-09-25", date_to: "2026-10-31" }, { onConflict: "name,date_from,date_to" }]);
    expect(saved).toMatchObject({ id: "L1", pricesAppliedAt: "2026-09-26T08:00:00Z" });
  });

  it("throws what Supabase reports", async () => {
    const client = fakeClient({ data: null, error: new Error("offline") });
    await expect(createLeafletStore(client).openLeaflets()).rejects.toThrow("offline");
  });
});
