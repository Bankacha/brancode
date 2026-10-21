import { describe, it, expect } from "vitest";
import { importLeaflet } from "./leafletImport.js";
import { fakeLeafletStore } from "../test/fakeLeafletStore.js";

const NOW = new Date("2026-09-26T08:00:00Z");
const bueno = { barcode: "8005276", name: "KINDER BUENO", price: 129.99 };
const vox = { barcode: "8606033882020", name: "VOX PEGLA", price: 2599.99 };
const leaflet = { name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31" };
const matches = [
  { ean: "80052760", name: "KINDER BUENO 43G", price: 99.99, existing: bueno },
  { ean: "8606033882020", name: "VOX PEGLA DBL 2550", price: 2199.99, existing: vox },
  { ean: "8600000000017", name: "NOVO", price: 50, existing: null },
];
const itemOf = (store, barcode) => store.db.items.find((i) => i.barcode === barcode);
const priceOf = (store, barcode) => store.db.products.find((p) => p.barcode === barcode).price;

describe("importLeaflet", () => {
  it("remembers each article's regular price and writes the promo price", async () => {
    const store = fakeLeafletStore({ products: [bueno, vox] });
    const result = await importLeaflet(store, { ...leaflet, matches }, "2026-09-26", NOW);
    expect(result).toEqual({ applied: true });
    expect(itemOf(store, "8005276")).toMatchObject({ name: "KINDER BUENO", promoPrice: 99.99, regularPrice: 129.99 });
    expect(priceOf(store, "8005276")).toBe(99.99);
    expect(priceOf(store, "8606033882020")).toBe(2199.99);
    expect(store.db.leaflets[0]).toMatchObject({ ...leaflet, pricesAppliedAt: NOW.toISOString() });
  });

  it("keeps articles that aren't in the database out of it", async () => {
    const store = fakeLeafletStore({ products: [bueno, vox] });
    await importLeaflet(store, { ...leaflet, matches }, "2026-09-26", NOW);
    expect(store.db.items.map((i) => i.barcode)).toEqual(["8005276", "8606033882020"]);
    expect(store.db.products).toHaveLength(2);
  });

  it("leaves prices alone until the first day of a promotion imported early", async () => {
    const store = fakeLeafletStore({ products: [bueno, vox] });
    const result = await importLeaflet(store, { ...leaflet, matches }, "2026-09-20", NOW);
    expect(result).toEqual({ applied: false });
    expect(priceOf(store, "8005276")).toBe(129.99);
    expect(itemOf(store, "8005276").regularPrice).toBe(129.99);
    expect(store.db.leaflets[0].pricesAppliedAt).toBeNull();
  });

  it("keeps the regular price from the first import when the same leaflet comes again", async () => {
    const store = fakeLeafletStore({ products: [bueno, vox] });
    await importLeaflet(store, { ...leaflet, matches }, "2026-09-26", NOW);
    const again = matches.map((m) => (m.existing ? { ...m, existing: { ...m.existing, price: m.price } } : m)); // the database now holds promo prices
    await importLeaflet(store, { ...leaflet, matches: again }, "2026-09-27", NOW);
    expect(store.db.leaflets).toHaveLength(1);
    expect(itemOf(store, "8005276").regularPrice).toBe(129.99);
  });

  it("takes the regular price from a running leaflet the article is already on", async () => {
    const store = fakeLeafletStore({
      leaflets: [{ id: "L0", name: "Septembar", dateFrom: "2026-09-01", dateTo: "2026-10-31", pricesAppliedAt: "2026-09-01T05:00:00Z" }],
      items: [{ leafletId: "L0", barcode: "8005276", name: "KINDER BUENO", promoPrice: 109.99, regularPrice: 129.99 }],
      products: [{ ...bueno, price: 109.99 }, vox],
    });
    await importLeaflet(store, { name: "Novembar", dateFrom: "2026-11-01", dateTo: "2026-11-30", matches: [{ ...matches[0], existing: { ...bueno, price: 109.99 } }] }, "2026-10-25", NOW);
    expect(store.db.items.find((i) => i.leafletId !== "L0").regularPrice).toBe(129.99);
  });
});
