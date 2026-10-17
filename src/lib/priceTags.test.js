import { describe, it, expect } from "vitest";
import { buildWorkbook, sheetFilename, tagRowsPerPage } from "./priceTags.js";

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, barcode: `86000050001${String(i).padStart(2, "0")}`, name: `Artikal ${i}`, price: 99 }));
const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const sheetFor = (format, queue) => buildWorkbook(queue, format, { barcodeImage: () => PNG_1PX }).getWorksheet("Cenovnici");
const breakRows = (format, n) => sheetFor(format, items(n)).rowBreaks.map((b) => b.id);

describe("tagRowsPerPage", () => {
  it("fits the same number of tag rows on an A4 page as before", () => {
    expect(tagRowsPerPage("shelf")).toBe(6);
    expect(tagRowsPerPage("fridge")).toBe(5);
    expect(tagRowsPerPage("fruit")).toBe(4);
  });
});

describe("buildWorkbook page breaks", () => {
  it.each(["shelf", "fridge", "fruit"])("adds no break while %s tags fit on one page", (format) => {
    for (const n of [0, 1, 3, 7]) expect(breakRows(format, n)).toEqual([]);
  });

  it.each([
    ["shelf", [12, 24]],
    ["fridge", [10, 20]],
    ["fruit", [12, 24, 36, 48]],
  ])("breaks 40 %s tags before the same rows as before", (format, expected) => {
    expect(breakRows(format, 40)).toEqual(expected);
  });

  it("writes the same full-width break Excel writes", () => {
    expect(sheetFor("shelf", items(40)).rowBreaks[0]).toEqual({ id: 12, max: 16383, man: 1 });
  });
});

describe("buildWorkbook cells", () => {
  it("writes name and price cells with the print fonts", () => {
    const sheet = sheetFor("shelf", [{ id: "a", barcode: "1", name: "MAJONEZ 175", price: 1249.99 }]);
    expect(sheet.getCell("A1").value).toBe("MAJONEZ 175");
    expect(sheet.getCell("A1").font).toEqual({ name: "Bahnschrift SemiBold", bold: true, size: 12 });
    expect(sheet.getCell("A2").value).toBe("1.249,99");
    expect(sheet.getCell("A2").font).toEqual({ name: "Oswald", bold: false, size: 42 });
    expect(sheet.getRow(1).height).toBe(28.5);
    expect(sheet.getRow(2).height).toBe(77.25);
  });

  it("embeds one barcode image per fruit tag", () => {
    expect(sheetFor("fruit", items(3)).getImages()).toHaveLength(3);
  });
});

describe("sheetFilename", () => {
  it("names the file after the format and the date", () => {
    expect(sheetFilename("fridge", new Date("2026-10-17T10:00:00Z"))).toBe("cenovnik-frizider-2026-10-17.xlsx");
  });
});
