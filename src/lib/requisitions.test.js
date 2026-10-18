import { describe, it, expect, vi } from "vitest";
import { createRequisitionStore, transferItems } from "./requisitions.js";

const fakeClient = (...results) => {
  const calls = [];
  const next = () => results.shift() ?? { data: null, error: null };
  const builder = (table) => {
    const query = { table, steps: [] };
    calls.push(query);
    const chain = new Proxy({}, {
      get: (_, method) =>
        method === "then"
          ? (resolve, reject) => Promise.resolve(next()).then(resolve, reject)
          : (...args) => (query.steps.push([method, ...args]), chain),
    });
    return chain;
  };
  return { calls, from: builder, rpc: (name, args) => (calls.push({ rpc: name, args }), Promise.resolve(next())) };
};

describe("requisition store", () => {
  it("maps an item with no barcode, price or quantity", async () => {
    const client = fakeClient({ data: [{ id: "i1", barcode: null, name: "Hleb za sendviče", price: null, quantity: null, created_at: "x" }], error: null });
    expect(await createRequisitionStore(client).items("t1")).toEqual([{ id: "i1", barcode: null, name: "Hleb za sendviče", price: null, quantity: null, createdAt: "x" }]);
    expect(client.calls[0].steps).toContainEqual(["eq", "requisition_id", "t1"]);
  });

  it("keeps empty fields empty when saving, instead of leaving them out", async () => {
    const client = fakeClient({ data: { id: "i2", barcode: null, name: "Hleb", price: null, quantity: null, created_at: "x" }, error: null });
    await createRequisitionStore(client).addItem("t1", { barcode: null, name: "Hleb", price: null, quantity: null });
    expect(client.calls[0].steps[0]).toEqual(["insert", { requisition_id: "t1", barcode: null, name: "Hleb", price: null, quantity: null }]);
  });

  it("adds quantities through its own function", async () => {
    const client = fakeClient({ data: { id: "i1", barcode: "1", name: "A", price: 1, quantity: 2, created_at: "x" }, error: null });
    await createRequisitionStore(client).addQuantity("i1", 2);
    expect(client.calls[0]).toEqual({ rpc: "add_requisition_quantity", args: { item_id: "i1", amount: 2 } });
  });

  it("names lists by their single date", async () => {
    const client = fakeClient({ data: [{ id: "t1", title: "", date: "2026-10-18", created_at: "x", requisition_items: [{ count: 2 }] }], error: null });
    expect(await createRequisitionStore(client).list()).toEqual([{ id: "t1", title: "", date: "2026-10-18", createdAt: "x", itemCount: 2 }]);
  });
});

describe("transferItems", () => {
  const store = (onTarget = {}) => ({
    findItem: vi.fn(async (_, code) => onTarget[code] ?? null),
    addItem: vi.fn(async () => ({ item: {} })),
    addQuantity: vi.fn(async () => ({})),
  });

  it("copies new items, adds to the ones already there and skips those with nothing to add", async () => {
    const s = store({ "111": { id: "x1" }, "222": { id: "x2" } });
    const items = [
      { barcode: "111", name: "Mleko", price: 100, quantity: 3 },
      { barcode: "222", name: "Jaja", price: 20, quantity: null },
      { barcode: "333", name: "Sir", price: null, quantity: 1 },
      { barcode: null, name: "Hleb za sendviče", price: null, quantity: null },
    ];
    expect(await transferItems(s, items, "t2")).toEqual({ copied: 2, added: 1, skipped: 1 });
    expect(s.addQuantity).toHaveBeenCalledWith("x1", 3);
    expect(s.addItem).toHaveBeenCalledWith("t2", { barcode: "333", name: "Sir", price: null, quantity: 1 });
    expect(s.addItem).toHaveBeenCalledWith("t2", { barcode: null, name: "Hleb za sendviče", price: null, quantity: null });
    expect(s.findItem).toHaveBeenCalledTimes(3); // not for the item without a barcode
  });

  it("adds to the item another phone put there in the meantime", async () => {
    const s = store();
    s.addItem.mockResolvedValueOnce({ duplicate: { id: "x9" } });
    expect(await transferItems(s, [{ barcode: "111", name: "Mleko", price: null, quantity: 2 }], "t2")).toEqual({ copied: 0, added: 1, skipped: 0 });
    expect(s.addQuantity).toHaveBeenCalledWith("x9", 2);
  });

  it("says how many were done when the connection drops halfway", async () => {
    const s = store();
    s.addItem.mockResolvedValueOnce({ item: {} }).mockRejectedValueOnce(new Error("Failed to fetch"));
    const items = [{ barcode: "1", name: "A", price: null, quantity: null }, { barcode: "2", name: "B", price: null, quantity: null }];
    await expect(transferItems(s, items, "t2")).rejects.toMatchObject({ done: 1 });
  });
});
