import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  barcodeImageBox,
  barcodeSymbology,
  buildWorkbook,
  columnWidthMm,
  layoutTagPages,
  priceParts,
  ptToMm,
  sheetFilename,
  shrinkFontPt,
  sideBarcodeBox,
  sideBarcodeLayout,
  tagGeometry,
  tagRowsPerPage,
} from "./priceTags.js";

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, barcode: `86000050001${String(i).padStart(2, "0")}`, name: `Artikal ${i}`, price: 99 }));
const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const sheetFor = (format, queue) =>
  buildWorkbook(queue, format, { barcodeImage: () => PNG_1PX, sideBarcodeImage: () => PNG_1PX }).getWorksheet("Cenovnici");
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
    expect(sheet.getCell("A2").font).toEqual({ name: "Oswald", bold: false, size: 42 });
    expect(sheet.getRow(1).height).toBe(28.5);
    expect(sheet.getRow(2).height).toBe(77.25);
  });

  it.each(["shelf", "fridge"])("prints %s decimals smaller and raised, as rich text", (format) => {
    const sheet = sheetFor(format, [{ id: "a", barcode: "1", name: "MAJONEZ 175", price: 1249.99 }]);
    const [whole, decimals] = sheet.getCell("A2").value.richText;
    expect(whole).toEqual({ text: "1.249", font: { name: "Oswald", size: 42 } });
    expect(decimals.text).toBe(",99");
    expect(decimals.font.vertAlign).toBe("superscript");
    expect(decimals.font.size).toBeLessThan(42);
  });

  it("gives each shelf tag a price column and a narrow barcode column, under one name", () => {
    const sheet = sheetFor("shelf", items(3));
    expect(sheet.columns.map((c) => c.width)).toEqual([21.7, 5, 21.7, 5, 21.7, 5]);
    expect(sheet.getCell("B1").isMerged).toBe(true);
    expect(sheet.getCell("B1").master.address).toBe("A1");
    expect(sheet.getCell("C1").value).toBe("Artikal 1");
    expect(sheet.getCell("E1").value).toBe("Artikal 2");
    expect(sheet.getCell("B2").isMerged).toBe(false);
  });

  it("closes the outline around the price and barcode cells without a line between them", () => {
    const sheet = sheetFor("fridge", items(1));
    expect(Object.keys(sheet.getCell("A2").border).sort()).toEqual(["bottom", "left", "top"]);
    expect(Object.keys(sheet.getCell("B2").border).sort()).toEqual(["bottom", "right", "top"]);
    expect(Object.keys(sheet.getCell("B1").border).sort()).toEqual(["bottom", "left", "right", "top"]);
  });

  it("puts one upright barcode beside each shelf and fridge price, in its own column", () => {
    for (const format of ["shelf", "fridge"]) {
      const images = sheetFor(format, items(3)).getImages();
      expect(images).toHaveLength(3);
      expect(images.map((img) => img.range.tl.nativeCol)).toEqual([1, 3, 5]);
      expect(images.every((img) => img.range.tl.nativeRow === 1)).toBe(true);
    }
  });

  it("leaves the barcode out of a tag with no code, or one that can't be drawn", () => {
    const queue = [{ id: "a", barcode: "", name: "A", price: 1 }, { id: "b", barcode: "x", name: "B", price: 1 }];
    const sheet = buildWorkbook(queue, "shelf", { sideBarcodeImage: (code) => { if (code === "x") throw new Error("bad"); return PNG_1PX; } }).getWorksheet("Cenovnici");
    expect(sheet.getImages()).toHaveLength(0);
    expect(sheet.getCell("C1").value).toBe("B");
  });

  it("writes a file that reads back with the merged names, rich-text prices and barcodes", async () => {
    const workbook = buildWorkbook(items(4), "shelf", { sideBarcodeImage: () => PNG_1PX });
    const reread = new ExcelJS.Workbook();
    await reread.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reread.getWorksheet("Cenovnici");
    expect(sheet.model.merges.sort()).toEqual(["A1:B1", "A3:B3", "C1:D1", "E1:F1"]);
    expect(sheet.getCell("A2").value.richText.map((r) => r.text)).toEqual(["99", ",00"]);
    expect(sheet.getImages()).toHaveLength(4);
  });

  it("hides Excel's on-screen grid, so only the tag outlines show (no line between price and barcode)", async () => {
    const workbook = buildWorkbook(items(2), "shelf", { sideBarcodeImage: () => PNG_1PX });
    const reread = new ExcelJS.Workbook();
    await reread.xlsx.load(await workbook.xlsx.writeBuffer());
    expect(reread.getWorksheet("Cenovnici").views[0].showGridLines).toBe(false);
  });

  it("keeps fruit tags as they were: one column each, plain price text", () => {
    const sheet = sheetFor("fruit", items(2));
    expect(sheet.columns.map((c) => c.width)).toEqual([40, 40]);
    expect(sheet.getCell("A2").value).toBe("99,00");
    expect(sheet.getCell("B1").value).toBe("Artikal 1");
  });

  it("embeds one barcode image per fruit tag", () => {
    expect(sheetFor("fruit", items(3)).getImages()).toHaveLength(3);
  });
});

describe("sheetFilename", () => {
  it("names the file after the format and the date", () => {
    expect(sheetFilename("fridge", new Date(2026, 9, 17, 10, 0))).toBe("cenovnik-frizider-17.10.2026.xlsx");
  });

  it("uses the shop's local date, not UTC (late evening is still today)", () => {
    expect(sheetFilename("shelf", new Date(2026, 9, 17, 23, 59))).toBe("cenovnik-raf-17.10.2026.xlsx");
    expect(sheetFilename("shelf", new Date(2026, 9, 18, 0, 30))).toBe("cenovnik-raf-18.10.2026.xlsx");
  });
});

describe("print geometry", () => {
  it("converts Excel column widths the way Excel lays them out", () => {
    expect(columnWidthMm(26.75)).toBeCloseTo(49.48, 2);
    expect(columnWidthMm(40)).toBeCloseTo(74.08, 2);
    expect(columnWidthMm(9.140625)).toBeCloseTo(16.93, 2); // Excel's default 64 px column
    expect(ptToMm(28.5)).toBeCloseTo(10.05, 2);
  });

  it("describes a shelf tag", () => {
    const g = tagGeometry("shelf");
    expect(g.columns).toBe(3);
    expect(g.widthMm).toBeCloseTo(49.48, 2);
    expect(g.nameHeightMm).toBeCloseTo(10.05, 2);
    expect(g.priceHeightMm).toBeCloseTo(27.25, 2);
    expect(g.barcodeHeightMm).toBe(0);
  });

  it("describes a fruit tag with its barcode row", () => {
    const g = tagGeometry("fruit");
    expect(g.columns).toBe(2);
    expect(g.nameHeightMm).toBeCloseTo(18, 2);
    expect(g.priceHeightMm).toBeCloseTo(29, 2);
    expect(g.barcodeHeightMm).toBeCloseTo(13, 2);
  });

  it("splits a shelf and fridge tag into a price column and a barcode column", () => {
    for (const format of ["shelf", "fridge"]) {
      const g = tagGeometry(format);
      expect(g.widthMm).toBeCloseTo(49.48, 2); // the same total width as before
      expect(g.priceWidthMm).toBeCloseTo(40.22, 2); // 152 px
      expect(g.columnWidthsMm[1]).toBeCloseTo(9.26, 2); // 35 px
    }
    expect(tagGeometry("fruit").priceWidthMm).toBeCloseTo(74.08, 2);
  });

  it("keeps the upright barcode inside its cell", () => {
    const g = tagGeometry("shelf");
    const box = sideBarcodeBox("shelf");
    expect(box.leftMm).toBeGreaterThan(0);
    expect(box.leftMm + box.widthMm).toBeLessThan(g.columnWidthsMm[1]);
    expect(box.topMm).toBeGreaterThan(0);
    expect(box.topMm + box.heightMm).toBeLessThan(g.priceHeightMm);
    expect(box.heightMm).toBeGreaterThan(25);
  });

  it("keeps the fridge barcode above the part the holder hides", () => {
    const g = tagGeometry("fridge");
    const box = sideBarcodeBox("fridge");
    expect(box.topMm + box.heightMm).toBeLessThanOrEqual(g.priceHeightMm - 5);
    expect(box.heightMm).toBeGreaterThan(20);
    expect(sideBarcodeBox("fruit")).toBeNull();
  });

  it("places the barcode image where the Excel export puts it", () => {
    const box = barcodeImageBox("fruit");
    expect(box.leftMm).toBeCloseTo(6.41, 2);
    expect(box.topMm).toBeCloseTo(1.3, 2);
    expect(box.widthMm).toBeCloseTo(62.59, 2);
    expect(box.heightMm).toBeCloseTo(10.37, 2);
    expect(barcodeImageBox("shelf")).toBeNull();
  });
});

describe("layoutTagPages", () => {
  const tagsPerPage = (format, n) => layoutTagPages(items(n), format).map((page) => page.flat().length);

  it("fills pages the same way the export breaks them", () => {
    expect(tagsPerPage("shelf", 40)).toEqual([18, 18, 4]);
    expect(layoutTagPages(items(40), "shelf").map((page) => page.length)).toEqual([6, 6, 2]);
    expect(tagsPerPage("fridge", 40)).toEqual([15, 15, 10]);
    expect(tagsPerPage("fruit", 40)).toEqual([8, 8, 8, 8, 8]);
  });

  it("fills rows by columns and leaves the last one short", () => {
    expect(layoutTagPages(items(7), "fruit")[0].map((row) => row.length)).toEqual([2, 2, 2, 1]);
  });

  it("has no pages for an empty list", () => {
    expect(layoutTagPages([], "shelf")).toEqual([]);
  });
});

describe("shrinkFontPt", () => {
  it("keeps the size when the price fits the cell", () => {
    expect(shrinkFontPt(42, 150, 187)).toBe(42);
  });

  it("shrinks a price that is wider than the cell, like Excel's shrink to fit", () => {
    expect(shrinkFontPt(42, 366, 187)).toBeCloseTo(21, 5);
  });
});

describe("barcodeSymbology", () => {
  it("prints codes stored without their check digit as the real symbol (JsBarcode adds the digit)", () => {
    expect(barcodeSymbology("8005276")).toBe("EAN8");
    expect(barcodeSymbology("03600029145")).toBe("UPC");
    expect(barcodeSymbology("12345")).toBe("CODE128");
  });

  it("uses EAN-13 for 12 digits (the POS export without its check digit) and valid 13-digit codes", () => {
    expect(barcodeSymbology("400638133393")).toBe("EAN13");
    expect(barcodeSymbology("4006381333931")).toBe("EAN13");
  });

  it("uses EAN-8 for a valid 8-digit code", () => {
    expect(barcodeSymbology("96385074")).toBe("EAN8");
  });

  it("falls back to CODE128 for anything else", () => {
    expect(barcodeSymbology("4006381333932")).toBe("CODE128"); // wrong check digit
    expect(barcodeSymbology("96385075")).toBe("CODE128");
    expect(barcodeSymbology("12345")).toBe("CODE128");
    expect(barcodeSymbology("AB-12")).toBe("CODE128");
  });

  it("draws nothing for an empty code", () => {
    expect(barcodeSymbology("")).toBeNull();
    expect(barcodeSymbology("  ")).toBeNull();
    expect(barcodeSymbology(undefined)).toBeNull();
  });
});

describe("priceParts", () => {
  it("splits the printed price into the whole part and the decimals", () => {
    expect(priceParts(1249.99)).toEqual({ whole: "1.249", decimals: ",99" });
    expect(priceParts(99)).toEqual({ whole: "99", decimals: ",00" });
    expect(priceParts(12499.5)).toEqual({ whole: "12.499", decimals: ",50" });
  });
});

describe("sideBarcodeLayout", () => {
  // EAN-13 drawn at 4 px a module with 7-module quiet zones: 109 modules.
  const lengthPx = 109 * 4;

  it("leaves most of the thickness to the bars, so a laser can sweep them at an angle", () => {
    for (const format of ["shelf", "fridge"]) {
      const box = sideBarcodeBox(format);
      const thickness = (lengthPx * box.widthMm) / box.heightMm;
      const { barHeight } = sideBarcodeLayout(lengthPx, box, 13);
      expect(barHeight / thickness).toBeGreaterThanOrEqual(0.75);
    }
  });

  it("keeps the small digits within the barcode's length", () => {
    const { fontSize } = sideBarcodeLayout(lengthPx, sideBarcodeBox("shelf"), 20);
    expect(fontSize * 0.6 * 20).toBeLessThanOrEqual(lengthPx * 0.9);
  });
});
