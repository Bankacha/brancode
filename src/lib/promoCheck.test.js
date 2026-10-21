import { describe, it, expect, vi } from "vitest";
import { addDays, belgradeToday, runPromoCheck } from "./promoCheck.js";
import { fakeLeafletStore } from "../test/fakeLeafletStore.js";

const NOW = new Date("2026-11-01T05:00:00Z");
const applied = "2026-09-25T08:00:00Z";
const avg = { id: "L1", name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31", pricesAppliedAt: applied };
const buenoItem = { leafletId: "L1", barcode: "8005276", name: "KINDER BUENO", promoPrice: 99.99, regularPrice: 129.99 };
const voxItem = { leafletId: "L1", barcode: "8606033882020", name: "VOX PEGLA", promoPrice: 2199.99, regularPrice: 2599.99 };

const run = async (store, today, now = NOW) => {
  const mails = [];
  const result = await runPromoCheck({ store, sendMail: async (mail) => void mails.push(mail), today, now });
  return { mails, result };
};
const priceOf = (store, barcode) => store.db.products.find((p) => p.barcode === barcode)?.price;
const resultOf = (store, leafletId, barcode) => store.db.items.find((i) => i.leafletId === leafletId && i.barcode === barcode).restoreResult;

describe("dates in Belgrade", () => {
  it("is already the next day in Belgrade late in the UTC evening", () => {
    expect(belgradeToday(new Date("2026-10-30T23:30:00Z"))).toBe("2026-10-31");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("runPromoCheck", () => {
  it("writes the promo prices of a leaflet imported early on its first morning", async () => {
    const store = fakeLeafletStore({
      leaflets: [{ ...avg, pricesAppliedAt: null }],
      items: [buenoItem],
      products: [{ barcode: "8005276", name: "KINDER BUENO", price: 129.99 }],
    });
    await run(store, "2026-09-24");
    expect(priceOf(store, "8005276")).toBe(129.99);
    await run(store, "2026-09-25", new Date("2026-09-25T05:00:00Z"));
    expect(priceOf(store, "8005276")).toBe(99.99);
    expect(store.db.leaflets[0].pricesAppliedAt).toBe("2026-09-25T05:00:00.000Z");
  });

  it("brings the regular prices back the morning after the promotion, without a mail", async () => {
    const store = fakeLeafletStore({
      leaflets: [avg],
      items: [buenoItem, voxItem],
      products: [
        { barcode: "8005276", name: "KINDER BUENO", price: 99.99 },
        { barcode: "8606033882020", name: "VOX PEGLA", price: 2199.99 },
      ],
    });
    const { mails } = await run(store, "2026-11-01");
    expect(priceOf(store, "8005276")).toBe(129.99);
    expect(priceOf(store, "8606033882020")).toBe(2599.99);
    expect(resultOf(store, "L1", "8005276")).toBe("restored");
    expect(store.db.leaflets[0].pricesRestoredAt).toBe(NOW.toISOString());
    expect(mails).toEqual([]);
  });

  it("leaves a price changed by hand and lists it in a mail", async () => {
    const store = fakeLeafletStore({
      leaflets: [avg],
      items: [buenoItem, voxItem],
      products: [
        { barcode: "8005276", name: "KINDER BUENO", price: 109.99 },
        { barcode: "8606033882020", name: "VOX PEGLA", price: 2199.99 },
      ],
    });
    const { mails } = await run(store, "2026-11-01");
    expect(priceOf(store, "8005276")).toBe(109.99);
    expect(resultOf(store, "L1", "8005276")).toBe("changed");
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe("Redovne cene vraćene: Jutro Liflet Avg");
    expect(mails[0].text).toContain("- KINDER BUENO (8005276): sada 109,99, redovna 129,99");
  });

  it("finds an article whose row was moved to its full code during the promotion", async () => {
    const store = fakeLeafletStore({
      leaflets: [avg],
      items: [{ ...buenoItem, barcode: "860000500012" }],
      products: [{ barcode: "8600005000122", name: "KINDER BUENO", price: 99.99 }],
    });
    await run(store, "2026-11-01");
    expect(priceOf(store, "8600005000122")).toBe(129.99);
    expect(resultOf(store, "L1", "860000500012")).toBe("restored");
  });

  it("hands an article on to the next leaflet, which brings back the price from before both", async () => {
    const store = fakeLeafletStore({
      leaflets: [avg, { id: "L2", name: "Novembar", dateFrom: "2026-11-01", dateTo: "2026-11-30" }],
      items: [buenoItem, { leafletId: "L2", barcode: "8005276", name: "KINDER BUENO", promoPrice: 89.99, regularPrice: 99.99 }],
      products: [{ barcode: "8005276", name: "KINDER BUENO", price: 99.99 }],
    });
    await run(store, "2026-11-01");
    expect(priceOf(store, "8005276")).toBe(89.99);
    expect(resultOf(store, "L1", "8005276")).toBe("newer_leaflet");
    expect(store.db.items.find((i) => i.leafletId === "L2").regularPrice).toBe(129.99);
    await run(store, "2026-12-01", new Date("2026-12-01T05:00:00Z"));
    expect(priceOf(store, "8005276")).toBe(129.99);
  });

  it("does nothing twice when it runs again the same day", async () => {
    const store = fakeLeafletStore({
      leaflets: [avg, { id: "L2", name: "Novembar", dateFrom: "2026-11-01", dateTo: "2026-11-02", pricesAppliedAt: applied }],
      items: [buenoItem],
      products: [{ barcode: "8005276", name: "KINDER BUENO", price: 109.99 }],
    });
    const first = await run(store, "2026-11-01");
    expect(first.mails.map((m) => m.subject)).toEqual(["Redovne cene vraćene: Jutro Liflet Avg", "Akcija ističe sutra: Novembar (02.11.2026.)"]);
    const before = JSON.stringify(store.db);
    const second = await run(store, "2026-11-01", new Date("2026-11-01T05:30:00Z"));
    expect(second.mails).toEqual([]);
    expect(JSON.stringify(store.db)).toBe(before);
  });

  it("finishes a restore that broke off halfway, without calling the restored prices changed", async () => {
    const store = fakeLeafletStore({
      leaflets: [avg],
      items: [buenoItem, voxItem],
      products: [
        { barcode: "8005276", name: "KINDER BUENO", price: 99.99 },
        { barcode: "8606033882020", name: "VOX PEGLA", price: 2199.99 },
      ],
    });
    store.failNext("setItemResults");
    await expect(run(store, "2026-11-01")).rejects.toThrow();
    const { mails } = await run(store, "2026-11-01");
    expect(priceOf(store, "8005276")).toBe(129.99);
    expect(store.db.items.map((i) => i.restoreResult)).toEqual(["restored", "restored"]);
    expect(store.db.leaflets[0].pricesRestoredAt).toBeTruthy();
    expect(mails).toEqual([]);
  });

  it("reminds the day before and on the last day, once each, listing the articles", async () => {
    const store = fakeLeafletStore({ leaflets: [avg], items: [voxItem, buenoItem], products: [] });
    const dayBefore = await run(store, "2026-10-30");
    expect(dayBefore.mails).toHaveLength(1);
    expect(dayBefore.mails[0].subject).toBe("Akcija ističe sutra: Jutro Liflet Avg (31.10.2026.)");
    expect(dayBefore.mails[0].text).toContain("(25.09.2026. – 31.10.2026.) ističe sutra.");
    expect(dayBefore.mails[0].text).toContain("- KINDER BUENO (8005276)\n- VOX PEGLA (8606033882020)");
    expect((await run(store, "2026-10-30")).mails).toEqual([]);
    const lastDay = await run(store, "2026-10-31");
    expect(lastDay.mails[0].subject).toBe("Akcija ističe danas: Jutro Liflet Avg (31.10.2026.)");
    expect(lastDay.mails[0].text).toContain("Redovne cene u bazi se vraćaju same sutra ujutru.");
    expect((await run(store, "2026-10-31")).mails).toEqual([]);
  });

  it("tries a reminder again when sending failed", async () => {
    const store = fakeLeafletStore({ leaflets: [avg], items: [buenoItem], products: [] });
    await runPromoCheck({ store, sendMail: async () => { throw new Error("resend down"); }, today: "2026-10-31", now: NOW });
    expect(store.db.leaflets[0].remindedTodayAt).toBeNull();
    expect((await run(store, "2026-10-31")).mails).toHaveLength(1);
  });

  it("only marks a leaflet that never wrote its prices as done after it ends", async () => {
    const store = fakeLeafletStore({
      leaflets: [{ ...avg, pricesAppliedAt: null }],
      items: [buenoItem],
      products: [{ barcode: "8005276", name: "KINDER BUENO", price: 129.99 }],
    });
    await run(store, "2026-11-01");
    expect(priceOf(store, "8005276")).toBe(129.99);
    expect(store.db.leaflets[0].pricesRestoredAt).toBeTruthy();
  });

  it("keeps the regular price when a first-morning run broke off after writing the promo prices", async () => {
    const store = fakeLeafletStore({
      leaflets: [{ ...avg, pricesAppliedAt: null }],
      items: [buenoItem],
      products: [{ barcode: "8005276", name: "KINDER BUENO", price: 129.99 }],
    });
    store.failNext("markLeaflet");
    await expect(run(store, "2026-09-25", new Date("2026-09-25T05:00:00Z"))).rejects.toThrow();
    await run(store, "2026-09-25", new Date("2026-09-25T05:30:00Z"));
    expect(store.db.items[0].regularPrice).toBe(129.99);
    await run(store, "2026-11-01");
    expect(priceOf(store, "8005276")).toBe(129.99);
  });

  it("hands an article on to the next leaflet also after a scan moved its row to the full code", async () => {
    const store = fakeLeafletStore({
      leaflets: [avg, { id: "L2", name: "Novembar", dateFrom: "2026-11-01", dateTo: "2026-11-30" }],
      items: [
        { ...buenoItem, barcode: "860000500012" },
        { leafletId: "L2", barcode: "8600005000122", name: "KINDER BUENO", promoPrice: 89.99, regularPrice: 99.99 },
      ],
      products: [{ barcode: "8600005000122", name: "KINDER BUENO", price: 99.99 }],
    });
    await run(store, "2026-11-01");
    expect(resultOf(store, "L1", "860000500012")).toBe("newer_leaflet");
    expect(store.db.items.find((i) => i.leafletId === "L2").regularPrice).toBe(129.99);
    await run(store, "2026-12-01", new Date("2026-12-01T05:00:00Z"));
    expect(priceOf(store, "8600005000122")).toBe(129.99);
  });

  it("hands every shared article on to the next leaflet in one write", async () => {
    const shared = Array.from({ length: 3 }, (_, i) => `86000000000${i}0`);
    const store = fakeLeafletStore({
      leaflets: [avg, { id: "L2", name: "Novembar", dateFrom: "2026-11-01", dateTo: "2026-11-30", pricesAppliedAt: applied }],
      items: shared.flatMap((barcode) => [
        { leafletId: "L1", barcode, name: barcode, promoPrice: 1, regularPrice: 3 },
        { leafletId: "L2", barcode, name: barcode, promoPrice: 2, regularPrice: 1 },
      ]),
      products: shared.map((barcode) => ({ barcode, name: barcode, price: 2 })),
    });
    const saveItems = vi.spyOn(store, "saveItems");
    await run(store, "2026-11-01");
    expect(saveItems).toHaveBeenCalledTimes(1);
    expect(store.db.items.filter((i) => i.leafletId === "L2").map((i) => i.regularPrice)).toEqual([3, 3, 3]);
  });
});
