import { describe, it, expect } from "vitest";
import { createMemoryEfakturaStore } from "./efakturaMemoryStore.js";

const invoice = { id: 77, number: "1", supplier: "A", supplierPib: null, amount: 10, amountWithoutVat: null, vat: null, currency: "RSD", status: "New", receivedAt: null, dueDate: "2026-12-19", send: null, decision: null };

const clock = (iso) => {
  let t = new Date(iso);
  return { now: () => t, set: (next) => (t = new Date(next)) };
};

describe("efaktura memory store", () => {
  it("has no settings until saved, then merges the fields given", async () => {
    const store = createMemoryEfakturaStore({ now: () => new Date("2026-11-19T09:00:00Z") });
    expect(await store.getSettings("mock")).toBeNull();
    await store.saveSettings("mock", { shopName: "Radnja", pib: "101234567", keyLast4: "1234" });
    const saved = await store.saveSettings("mock", { keyLast4: null });
    expect(saved).toMatchObject({ mode: "mock", shopName: "Radnja", pib: "101234567", keyLast4: null, baselineIds: [], updatedAt: "2026-11-19T09:00:00.000Z" });
    expect(await store.getSettings("mock")).toEqual(saved);
  });

  it("keeps the modes apart", async () => {
    const store = createMemoryEfakturaStore();
    await store.saveSettings("production", { shopName: "Prava", keyLast4: "9999" });
    await store.saveSettings("mock", { shopName: "Proba", keyLast4: "0000" });
    expect(await store.getSettings("production")).toMatchObject({ shopName: "Prava", keyLast4: "9999" });
  });

  it("returns copies, so a caller can't change what is stored", async () => {
    const store = createMemoryEfakturaStore();
    const saved = await store.saveSettings("mock", { baselineIds: [1] });
    saved.baselineIds.push(2);
    expect((await store.getSettings("mock")).baselineIds).toEqual([1]);
  });

  it("gives one mode's events since a time, oldest first", async () => {
    const c = clock("2026-11-01T08:00:00Z");
    const store = createMemoryEfakturaStore({ now: c.now });
    await store.addEvent({ mode: "mock", invoiceId: 1, action: "accepted", userId: "u", userEmail: "a@b", snapshot: invoice });
    c.set("2026-11-18T08:00:00Z");
    await store.addEvent({ mode: "mock", invoiceId: 2, action: "rejected", comment: "Cena", userId: "u", userEmail: "a@b", snapshot: invoice });
    await store.addEvent({ mode: "production", invoiceId: 3, action: "sent", recipient: "r@b", userId: "u", userEmail: "a@b", snapshot: invoice });
    await store.addEvents([{ mode: "production", invoiceId: 4, action: "sent", recipient: "r@b", userId: "u", userEmail: "a@b", snapshot: invoice }]);
    c.set("2026-11-19T08:00:00Z");
    await store.addEvent({ mode: "mock", invoiceId: 4, action: "sent", recipient: "r@b", userId: "u", userEmail: "a@b", snapshot: invoice });
    expect(await store.eventsSince("mock", "2026-11-10")).toEqual([
      { invoiceId: 2, action: "rejected", comment: "Cena", recipient: null, userEmail: "a@b", createdAt: "2026-11-18T08:00:00.000Z" },
      { invoiceId: 4, action: "sent", comment: null, recipient: "r@b", userEmail: "a@b", createdAt: "2026-11-19T08:00:00.000Z" },
    ]);
    expect((await store.eventsSince("production", "2026-11-10")).map((e) => e.invoiceId)).toEqual([3, 4]);
  });

  it("deletes only the test events", async () => {
    const store = createMemoryEfakturaStore();
    await store.addEvent({ mode: "mock", invoiceId: 1, action: "accepted", snapshot: invoice });
    await store.addEvent({ mode: "production", invoiceId: 2, action: "accepted", snapshot: invoice });
    await store.deleteMockEvents();
    expect(await store.eventsSince("mock", "2000-01-01")).toEqual([]);
    expect(await store.eventsSince("production", "2000-01-01")).toHaveLength(1);
  });

  it("offers no way to change or remove a real event", () => {
    const store = createMemoryEfakturaStore();
    expect(Object.keys(store).sort()).toEqual(["addEvent", "addEvents", "deleteMockEvents", "eventsSince", "getSettings", "saveSettings"]);
  });
});
