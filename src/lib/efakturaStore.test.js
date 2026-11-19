import { describe, it, expect } from "vitest";
import { createEfakturaStore } from "./efakturaStore.js";

// Records every chained call and answers each awaited query with the next
// prepared result (as in leafletStore.test.js).
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

const NOW = new Date("2026-11-19T09:00:00Z");
const store = (client) => createEfakturaStore(client, { now: () => NOW });

const settingsRow = {
  mode: "production",
  key_ciphertext: "c",
  key_iv: "i",
  key_tag: "t",
  key_last4: "1234",
  shop_name: "Radnja",
  pib: "101234567",
  send_to: null,
  connected_at: "2026-11-18T08:00:00Z",
  baseline_ids: [5, 6],
  updated_by: "brat@primer.test",
  updated_at: "2026-11-18T08:00:00Z",
};

const settings = {
  mode: "production",
  keyCiphertext: "c",
  keyIv: "i",
  keyTag: "t",
  keyLast4: "1234",
  shopName: "Radnja",
  pib: "101234567",
  sendTo: null,
  connectedAt: "2026-11-18T08:00:00Z",
  baselineIds: [5, 6],
  updatedBy: "brat@primer.test",
  updatedAt: "2026-11-18T08:00:00Z",
};

const invoice = {
  id: 77,
  number: "12/2026",
  supplier: "Pekara Klasje d.o.o.",
  supplierPib: "100000025",
  amount: 1200,
  amountWithoutVat: 1000,
  vat: 200,
  currency: "RSD",
  status: "New",
  receivedAt: "2026-11-19T07:00:00Z",
  dueDate: "2026-12-19",
  send: null,
  decision: null,
};

describe("efaktura store (Supabase)", () => {
  it("reads one mode's settings in camelCase", async () => {
    const client = fakeClient({ data: settingsRow, error: null });
    expect(await store(client).getSettings("production")).toEqual(settings);
    expect(client.calls[0].table).toBe("efaktura_settings");
    expect(client.calls[0].steps).toContainEqual(["eq", "mode", "production"]);
    expect(client.calls[0].steps.map((s) => s[0])).toContain("maybeSingle");
  });

  it("gives null when the mode has no settings yet", async () => {
    expect(await store(fakeClient({ data: null, error: null })).getSettings("mock")).toBeNull();
  });

  it("upserts only the fields given, by mode, stamping the time", async () => {
    const client = fakeClient({ data: settingsRow, error: null });
    const saved = await store(client).saveSettings("production", { shopName: "Radnja", pib: "101234567", keyCiphertext: null });
    const upsert = client.calls[0].steps.find((s) => s[0] === "upsert");
    expect(upsert[1]).toEqual({ mode: "production", shop_name: "Radnja", pib: "101234567", key_ciphertext: null, updated_at: NOW.toISOString() });
    expect(upsert[2]).toEqual({ onConflict: "mode" });
    expect(saved).toEqual(settings);
  });

  it("adds an event with the invoice as it was", async () => {
    const client = fakeClient({ data: null, error: null });
    await store(client).addEvent({ mode: "production", invoiceId: 77, action: "accepted", userId: "u1", userEmail: "brat@primer.test", snapshot: invoice });
    expect(client.calls[0].table).toBe("efaktura_events");
    expect(client.calls[0].steps).toContainEqual([
      "insert",
      {
        mode: "production",
        invoice_id: 77,
        action: "accepted",
        comment: null,
        recipient: null,
        user_id: "u1",
        user_email: "brat@primer.test",
        supplier: "Pekara Klasje d.o.o.",
        supplier_pib: "100000025",
        invoice_number: "12/2026",
        received_at: "2026-11-19T07:00:00Z",
        due_date: "2026-12-19",
        amount: 1200,
        amount_without_vat: 1000,
        vat: 200,
        currency: "RSD",
        sef_status: "New",
      },
    ]);
  });

  it("reads one mode's events since a time, oldest first", async () => {
    const row = { invoice_id: 77, action: "sent", comment: null, recipient: "radnja@primer.test", user_email: "brat@primer.test", created_at: "2026-11-19T08:00:00Z" };
    const client = fakeClient({ data: [row], error: null });
    expect(await store(client).eventsSince("production", "2026-09-20")).toEqual([
      { invoiceId: 77, action: "sent", comment: null, recipient: "radnja@primer.test", userEmail: "brat@primer.test", createdAt: "2026-11-19T08:00:00Z" },
    ]);
    const steps = client.calls[0].steps;
    expect(steps).toContainEqual(["eq", "mode", "production"]);
    expect(steps).toContainEqual(["gte", "created_at", "2026-09-20"]);
    expect(steps).toContainEqual(["order", "created_at", { ascending: true }]);
  });

  it("reads every page of events, not only the first thousand", async () => {
    const row = (n) => ({ invoice_id: n, action: "sent", comment: null, recipient: null, user_email: null, created_at: "2026-11-19T08:00:00Z" });
    const page = (from, count) => ({ data: Array.from({ length: count }, (_, i) => row(from + i)), error: null });
    const client = fakeClient(page(0, 1000), page(1000, 3));
    const events = await store(client).eventsSince("production", "2026-09-20");
    expect(events).toHaveLength(1003);
    expect(client.calls.map((c) => c.steps.find((s) => s[0] === "range"))).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ]);
  });

  it("deletes only the test events", async () => {
    const client = fakeClient({ data: null, error: null });
    await store(client).deleteMockEvents();
    expect(client.calls[0].table).toBe("efaktura_events");
    expect(client.calls[0].steps).toEqual([["delete"], ["eq", "mode", "mock"]]);
  });

  it("passes a database error on", async () => {
    const failing = () => fakeClient({ data: null, error: new Error("db down") });
    await expect(store(failing()).getSettings("mock")).rejects.toThrow("db down");
    await expect(store(failing()).saveSettings("mock", { pib: "101234567" })).rejects.toThrow("db down");
    await expect(store(failing()).addEvent({ mode: "mock", invoiceId: 1, action: "sent", snapshot: invoice })).rejects.toThrow("db down");
    await expect(store(failing()).eventsSince("mock", "2026-09-20")).rejects.toThrow("db down");
    await expect(store(failing()).deleteMockEvents()).rejects.toThrow("db down");
  });
});
