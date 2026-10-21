import { describe, it, expect, vi } from "vitest";
import { withLeafletMarks } from "./leafletMarks.js";
import { fakeLeafletStore } from "../test/fakeLeafletStore.js";

const store = () =>
  fakeLeafletStore({
    leaflets: [{ id: "L1", name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31", pricesAppliedAt: "x" }],
    items: [
      { leafletId: "L1", barcode: "8005276", name: "KINDER BUENO", promoPrice: 99.99, regularPrice: 129.99 },
      { leafletId: "L1", barcode: "860000500012", name: "MAJONEZ", promoPrice: 84.99, regularPrice: 99.99 },
    ],
  });
const marks = async (items, date = "2026-10-18", s = store()) => (await withLeafletMarks(s, date, items)).map((i) => i.onLeaflet);

describe("withLeafletMarks", () => {
  it("marks an article whose price is the leaflet price on the trebovanje's date", async () => {
    expect(await marks([{ id: "a", barcode: "80052760", name: "KINDER BUENO", price: 99.99 }])).toEqual([true]);
  });

  it("doesn't mark it outside the promotion", async () => {
    expect(await marks([{ id: "a", barcode: "80052760", name: "KINDER BUENO", price: 99.99 }], "2026-11-01")).toEqual([false]);
  });

  it("doesn't mark a price that isn't the leaflet price", async () => {
    expect(await marks([{ id: "a", barcode: "80052760", name: "KINDER BUENO", price: 129.99 }])).toEqual([false]);
  });

  it("finds a 13-digit item on a leaflet that stored 12 digits", async () => {
    expect(await marks([{ id: "a", barcode: "8600005000122", name: "MAJONEZ", price: 84.99 }])).toEqual([true]);
  });

  it("never marks an item without a barcode or a price", async () => {
    expect(
      await marks([
        { id: "a", barcode: null, name: "Hleb", price: 99.99 },
        { id: "b", barcode: "80052760", name: "KINDER BUENO", price: null },
      ])
    ).toEqual([false, false]);
  });

  it("shows the trebovanje unmarked when the leaflets can't be read", async () => {
    const s = store();
    s.failNext("leafletsOn");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const items = [{ id: "a", barcode: "80052760", name: "KINDER BUENO", price: 99.99 }];
    expect(await withLeafletMarks(s, "2026-10-18", items)).toEqual([{ ...items[0], onLeaflet: false }]);
  });
});
