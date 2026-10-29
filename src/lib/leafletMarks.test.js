import { describe, it, expect, vi } from "vitest";
import { leafletBadgeText, withLeafletMarks } from "./leafletMarks.js";
import { fakeLeafletStore } from "../test/fakeLeafletStore.js";

// Trebovanje of 27.10.: L1 runs (25.09.–31.10.), L2 starts in five days
// (01.11.–30.11.), L3 too late (20.11.–30.11.), L0 is over (01.09.–24.09.).
const store = () =>
  fakeLeafletStore({
    leaflets: [
      { id: "L0", name: "Avg", dateFrom: "2026-09-01", dateTo: "2026-09-24", pricesAppliedAt: "x" },
      { id: "L1", name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31", pricesAppliedAt: "x" },
      { id: "L2", name: "Novembar", dateFrom: "2026-11-01", dateTo: "2026-11-30" },
      { id: "L3", name: "Kasni", dateFrom: "2026-11-20", dateTo: "2026-11-30" },
    ],
    items: [
      { leafletId: "L0", barcode: "8005276", name: "KINDER BUENO", promoPrice: 89.99, regularPrice: 129.99 },
      { leafletId: "L1", barcode: "8005276", name: "KINDER BUENO", promoPrice: 99.99, regularPrice: 129.99 },
      { leafletId: "L1", barcode: "860000500012", name: "MAJONEZ", promoPrice: 84.99, regularPrice: 99.99 },
      { leafletId: "L2", barcode: "8600005000122", name: "MAJONEZ", promoPrice: 79.99, regularPrice: 99.99 },
      { leafletId: "L2", barcode: "8606107654321", name: "JOGURT", promoPrice: 169.99, regularPrice: 189.99 },
      { leafletId: "L3", barcode: "8600939000001", name: "MLEKO", promoPrice: 99.99, regularPrice: 129.99 },
    ],
  });
const marked = async (item, date = "2026-10-27", s = store()) => (await withLeafletMarks(s, date, [{ id: "a", name: "A", price: 1, ...item }]))[0];

describe("withLeafletMarks", () => {
  it("lists a running leaflet, whatever price the item has", async () => {
    const item = await marked({ barcode: "80052760", price: 129.99 });
    expect(item.leaflets).toEqual([{ leafletId: "L1", promoPrice: 99.99, dateFrom: "2026-09-25", dateTo: "2026-10-31", upcoming: false }]);
    expect(item.onLeaflet).toBe(true);
  });

  it("lists a leaflet that starts within 14 days as upcoming", async () => {
    expect((await marked({ barcode: "8606107654321" })).leaflets).toEqual([
      { leafletId: "L2", promoPrice: 169.99, dateFrom: "2026-11-01", dateTo: "2026-11-30", upcoming: true },
    ]);
  });

  it("lists both leaflets of an article on both, the running one first, once each whatever code they stored", async () => {
    const item = await marked({ barcode: "8600005000122" });
    expect(item.leaflets.map((l) => [l.leafletId, l.upcoming])).toEqual([
      ["L1", false],
      ["L2", true],
    ]);
  });

  it("leaves out leaflets starting more than 14 days after the trebovanje, and those already over", async () => {
    expect((await marked({ barcode: "8600939000001" })).leaflets).toEqual([]);
    expect((await marked({ barcode: "80052760" }, "2026-10-27")).leaflets.map((l) => l.leafletId)).toEqual(["L1"]);
  });

  it("has no leaflets for an item without a barcode", async () => {
    const item = await marked({ barcode: null });
    expect(item.leaflets).toEqual([]);
    expect(item.onLeaflet).toBe(false);
  });

  it("shows the trebovanje without leaflets when they can't be read", async () => {
    const s = store();
    s.failNext("leafletsBetween");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await marked({ barcode: "80052760" }, "2026-10-27", s)).leaflets).toEqual([]);
  });
});

describe("leafletBadgeText", () => {
  it("says until when a running leaflet lasts", () => {
    expect(leafletBadgeText({ promoPrice: 99.99, dateFrom: "2026-09-25", dateTo: "2026-10-31", upcoming: false })).toBe("Liflet 99,99 do 31.10.");
  });

  it("says when an upcoming one starts", () => {
    expect(leafletBadgeText({ promoPrice: 89.99, dateFrom: "2026-11-01", dateTo: "2026-11-30", upcoming: true })).toBe("Liflet 89,99 · USKORO od 01.11.");
  });
});
