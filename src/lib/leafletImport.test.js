import { describe, it, expect } from "vitest";
import { findSameLeaflet, importLeaflet } from "./leafletImport.js";
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

  it("finds the running leaflet's regular price after a scan moved the row to its full code", async () => {
    const store = fakeLeafletStore({
      leaflets: [{ id: "L0", name: "Septembar", dateFrom: "2026-09-01", dateTo: "2026-10-31", pricesAppliedAt: "2026-09-01T05:00:00Z" }],
      items: [{ leafletId: "L0", barcode: "860000500012", name: "MAJONEZ", promoPrice: 99.99, regularPrice: 129.99 }],
      products: [{ barcode: "8600005000122", name: "MAJONEZ", price: 99.99 }],
    });
    const moved = { barcode: "8600005000122", name: "MAJONEZ", price: 99.99 };
    await importLeaflet(store, { name: "Novembar", dateFrom: "2026-11-01", dateTo: "2026-11-30", matches: [{ ean: "8600005000122", name: "MAJONEZ 175", price: 89.99, existing: moved }] }, "2026-10-25", NOW);
    expect(store.db.items.find((i) => i.leafletId !== "L0").regularPrice).toBe(129.99);
  });

  it("names an article by the leaflet when the database has no name for it", async () => {
    const store = fakeLeafletStore({ products: [{ ...bueno, name: null }] });
    await importLeaflet(store, { ...leaflet, matches: [{ ...matches[0], existing: { ...bueno, name: null } }] }, "2026-09-26", NOW);
    expect(itemOf(store, "8005276").name).toBe("KINDER BUENO 43G");
  });
});

describe("findSameLeaflet", () => {
  // the open leaflet "Jutro Liflet Avg" 25.09.–31.10. with five articles
  const codes = ["8600000000017", "8600000000024", "8600000000031", "8600000000048", "8600000000055"];
  const open = () =>
    fakeLeafletStore({
      leaflets: [{ id: "L1", name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31", pricesAppliedAt: "x" }],
      items: codes.map((barcode) => ({ leafletId: "L1", barcode, name: barcode, promoPrice: 1, regularPrice: 2 })),
    });
  const article = (barcode) => ({ ean: barcode, name: barcode, price: 1, existing: { barcode, name: barcode, price: 2 } });
  const newLeaflet = (fields) => ({ name: "Novembar", dateFrom: "2026-10-25", dateTo: "2026-11-30", matches: codes.map(article), ...fields });

  it("finds the open leaflet with the same name that overlaps", async () => {
    expect((await findSameLeaflet(open(), newLeaflet({ name: " jutro liflet avg ", matches: [article("1")] })))?.id).toBe("L1");
  });

  it("finds an overlapping leaflet with most of the same articles under another name", async () => {
    const matches = [...codes.slice(0, 4).map(article), article("8600000000062")];
    expect((await findSameLeaflet(open(), newLeaflet({ matches })))?.id).toBe("L1");
  });

  it("doesn't ask for a new leaflet imported early with few of the same articles", async () => {
    const matches = [article(codes[0]), ...["8600000000062", "8600000000079", "8600000000086", "8600000000093"].map(article)];
    expect(await findSameLeaflet(open(), newLeaflet({ matches }))).toBeNull();
  });

  it("doesn't ask when the periods don't overlap", async () => {
    expect(await findSameLeaflet(open(), newLeaflet({ name: "Jutro Liflet Avg", dateFrom: "2026-11-01" }))).toBeNull();
  });

  it("doesn't ask for the same name and the same dates, which is just the same import again", async () => {
    expect(await findSameLeaflet(open(), newLeaflet({ name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31" }))).toBeNull();
  });

  // Records from before 0.13.0: the same leaflet saved twice, the second time with corrected dates.
  const twice = (name) =>
    fakeLeafletStore({
      leaflets: [
        { id: "L1", name, dateFrom: "2026-09-25", dateTo: "2026-10-31", pricesAppliedAt: "x" },
        { id: "L2", name, dateFrom: "2026-09-25", dateTo: "2026-11-02", pricesAppliedAt: "x" },
      ],
      items: ["L1", "L2"].flatMap((leafletId) => codes.map((barcode) => ({ leafletId, barcode, name: barcode, promoPrice: 1, regularPrice: 2 }))),
    });

  it("doesn't ask when a record with the same name already has the new dates, which the import goes onto", async () => {
    expect(await findSameLeaflet(twice("Jutro Liflet Avg"), newLeaflet({ name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-11-02" }))).toBeNull();
  });

  it("never offers a leaflet whose name already has the new dates on another record", async () => {
    expect((await findSameLeaflet(twice("liflet-okt"), newLeaflet({ dateFrom: "2026-09-25", dateTo: "2026-11-02" })))?.id).toBe("L2");
  });
});

describe("importLeaflet onto a leaflet with corrected dates", () => {
  const store = (reminded) =>
    fakeLeafletStore({
      leaflets: [{ id: "L1", name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31", pricesAppliedAt: "x", remindedTomorrowAt: reminded, remindedTodayAt: reminded }],
      items: [{ leafletId: "L1", barcode: "8005276", name: "KINDER BUENO", promoPrice: 99.99, regularPrice: 129.99 }],
      products: [{ ...bueno, price: 99.99 }],
    });

  it("moves the existing leaflet to the new dates and asks again for the reminders of a new end", async () => {
    const s = store("2026-10-30T05:00:00Z");
    await importLeaflet(s, { name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-11-02", matches: [{ ...matches[0], existing: { ...bueno, price: 99.99 } }], replaceId: "L1" }, "2026-10-28", NOW);
    expect(s.db.leaflets).toHaveLength(1);
    expect(s.db.leaflets[0]).toMatchObject({ dateFrom: "2026-09-25", dateTo: "2026-11-02", remindedTomorrowAt: null, remindedTodayAt: null });
    expect(s.db.items).toHaveLength(1);
    expect(s.db.items[0].regularPrice).toBe(129.99);
  });

  it("keeps the reminders when only the start was corrected", async () => {
    const s = store("2026-10-30T05:00:00Z");
    await importLeaflet(s, { name: "Jutro Liflet Avg", dateFrom: "2026-09-26", dateTo: "2026-10-31", matches: [{ ...matches[0], existing: { ...bueno, price: 99.99 } }], replaceId: "L1" }, "2026-10-28", NOW);
    expect(s.db.leaflets[0]).toMatchObject({ dateFrom: "2026-09-26", remindedTomorrowAt: "2026-10-30T05:00:00Z" });
  });
});
