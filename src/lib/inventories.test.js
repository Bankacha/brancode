import { describe, it, expect } from "vitest";
import { createInventoryStore } from "./inventories.js";

// A stand-in for the Supabase client: records every chained call and answers
// each awaited query with the next prepared result.
const fakeClient = (...results) => {
  const calls = [];
  const next = () => results.shift() ?? { data: null, error: null };
  const builder = (table) => {
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
  return {
    calls,
    from: builder,
    rpc: (name, args) => {
      calls.push({ rpc: name, args });
      return Promise.resolve(next());
    },
  };
};

const itemRow = { id: "it1", barcode: "4006381333931", name: "Čokolada", price: 120, quantity: 2, in_products: true, created_at: "2026-10-18T10:00:00Z" };

describe("inventory store", () => {
  it("lists popisi newest first with their item counts", async () => {
    const client = fakeClient({ data: [{ id: "p1", title: "", date_from: "2026-10-01", date_to: "2026-10-18", created_at: "x", inventory_items: [{ count: 3 }] }], error: null });
    const lists = await createInventoryStore(client).list();
    expect(lists).toEqual([{ id: "p1", title: "", dateFrom: "2026-10-01", dateTo: "2026-10-18", createdAt: "x", itemCount: 3 }]);
    expect(client.calls[0].table).toBe("inventories");
    expect(client.calls[0].steps).toContainEqual(["order", "created_at", { ascending: false }]);
  });

  it("creates a popis from camelCase fields", async () => {
    const client = fakeClient({ data: { id: "p2", title: "Magacin", date_from: "2026-10-01", date_to: "2026-10-18", created_at: "x" }, error: null });
    const created = await createInventoryStore(client).create({ title: "Magacin", dateFrom: "2026-10-01", dateTo: "2026-10-18" });
    expect(client.calls[0].steps[0]).toEqual(["insert", { title: "Magacin", date_from: "2026-10-01", date_to: "2026-10-18" }]);
    expect(created.id).toBe("p2");
  });

  it("looks for the same article under all its codes", async () => {
    const client = fakeClient({ data: [itemRow], error: null });
    const found = await createInventoryStore(client).findItem("p1", "400638133393");
    expect(client.calls[0].steps).toContainEqual(["in", "barcode", ["400638133393", "4006381333931"]]);
    expect(found).toEqual({ id: "it1", barcode: "4006381333931", name: "Čokolada", price: 120, quantity: 2, inProducts: true, createdAt: "2026-10-18T10:00:00Z" });
  });

  it("turns a unique-barcode clash (another phone was faster) into the existing item", async () => {
    const client = fakeClient({ data: null, error: { code: "23505", message: "duplicate key" } }, { data: [itemRow], error: null });
    const result = await createInventoryStore(client).addItem("p1", { barcode: "4006381333931", name: "Čokolada", price: 120, quantity: 1, inProducts: true });
    expect(result).toEqual({ duplicate: expect.objectContaining({ id: "it1", quantity: 2 }) });
    expect(client.calls[0].steps[0]).toEqual(["insert", { inventory_id: "p1", barcode: "4006381333931", name: "Čokolada", price: 120, quantity: 1, in_products: true }]);
  });

  it("adds to a quantity in the database, not from a value read earlier", async () => {
    const client = fakeClient({ data: { ...itemRow, quantity: 3.5 }, error: null });
    const item = await createInventoryStore(client).addQuantity("it1", 1.5);
    expect(client.calls[0]).toEqual({ rpc: "add_inventory_quantity", args: { item_id: "it1", amount: 1.5 } });
    expect(item.quantity).toBe(3.5);
  });

  it("passes other errors on, e.g. no connection", async () => {
    const client = fakeClient({ data: null, error: { message: "Failed to fetch" } });
    await expect(createInventoryStore(client).items("p1")).rejects.toEqual({ message: "Failed to fetch" });
  });

  it("puts a removed item back under its own id", async () => {
    const client = fakeClient({ data: itemRow, error: null });
    await createInventoryStore(client).restoreItem("p1", { id: "it1", barcode: "4006381333931", name: "Čokolada", price: 120, quantity: 2, inProducts: true });
    expect(client.calls[0].steps[0]).toEqual(["insert", { id: "it1", inventory_id: "p1", barcode: "4006381333931", name: "Čokolada", price: 120, quantity: 2, in_products: true }]);
  });

  it("says when a popis no longer exists", async () => {
    const client = fakeClient({ data: null, error: null });
    expect(await createInventoryStore(client).get("gone")).toBeNull();
  });

  it("tells a deleted popis apart from a lost connection when adding to it", async () => {
    const client = fakeClient({ data: null, error: { code: "23503", message: "violates foreign key constraint" } });
    expect(await createInventoryStore(client).addItem("gone", { barcode: "1", name: "A", price: 1, quantity: 1, inProducts: false })).toEqual({ listGone: true });
  });

  it("treats a clash whose item vanished again as a failed request, not as no item", async () => {
    const client = fakeClient({ data: null, error: { code: "23505", message: "duplicate key" } }, { data: [], error: null });
    await expect(createInventoryStore(client).addItem("p1", { barcode: "1", name: "A", price: 1, quantity: 1, inProducts: false })).rejects.toMatchObject({ code: "23505" });
  });

  it("puts a removed item back where it was in the list", async () => {
    const client = fakeClient({ data: itemRow, error: null });
    await createInventoryStore(client).restoreItem("p1", { id: "it1", barcode: "4006381333931", name: "Čokolada", price: 120, quantity: 2, inProducts: true, createdAt: "2026-10-18T10:00:00Z" });
    expect(client.calls[0].steps[0][1]).toMatchObject({ id: "it1", created_at: "2026-10-18T10:00:00Z" });
  });
});
