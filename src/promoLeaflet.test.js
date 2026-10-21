import { describe, it, expect } from "vitest";
import { leafletPeriodFromText, linesFromTextItems, rowsFromTextItems } from "./promoLeaflet.js";

const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });

describe("rowsFromTextItems", () => {
  it("reads EAN, name and the price right before the Marža %", () => {
    const rows = rowsFromTextItems([
      item("1001", 10, 500), item("8600005000122", 60, 500), item("MAJONEZ 175 2.8%T", 160, 501),
      item("84,99", 300, 500), item("25%", 340, 500), item("100,00", 380, 500),
    ]);
    expect(rows).toEqual([{ ean: "8600005000122", name: "MAJONEZ 175 2.8%T", price: 84.99 }]);
  });

  it("keeps a decimal inside the name out of the price", () => {
    const rows = rowsFromTextItems([
      item("1002", 10, 400), item("8606004251657", 60, 400), item("SOK NEKTAR 1,00 L", 160, 400),
      item("185,00", 300, 400), item("25%", 340, 400),
    ]);
    expect(rows).toEqual([{ ean: "8606004251657", name: "SOK NEKTAR 1,00 L", price: 185 }]);
  });

  it("joins items of one line in x order", () => {
    const rows = rowsFromTextItems([
      item("25%", 340, 500), item("84,99", 300, 500), item("MAJONEZ 175", 160, 500),
      item("8600005000122", 60, 500), item("1001", 10, 500),
    ]);
    expect(rows.map((r) => r.ean)).toEqual(["8600005000122"]);
  });

  it("ignores lines that are not article rows", () => {
    expect(rowsFromTextItems([item("Šifra", 10, 700), item("EAN", 60, 700), item("Naziv", 160, 700)])).toEqual([]);
  });
});

describe("linesFromTextItems", () => {
  it("joins the items of each line left to right, top line first", () => {
    expect(linesFromTextItems([item("do 31.10.2026", 200, 800), item("Jutro Liflet Avg od 25.09.2026", 10, 801), item("Šifra", 10, 700)])).toEqual([
      "Jutro Liflet Avg od 25.09.2026 do 31.10.2026",
      "Šifra",
    ]);
  });
});

describe("leafletPeriodFromText", () => {
  it("reads the name and the period from the leaflet's first line", () => {
    expect(leafletPeriodFromText("Jutro Liflet Avg od 25.09.2026 do 31.10.2026")).toEqual({
      name: "Jutro Liflet Avg",
      dateFrom: "2026-09-25",
      dateTo: "2026-10-31",
    });
  });

  it("takes single-digit days and months and trailing dots, without a name", () => {
    expect(leafletPeriodFromText("od 1.9.2026. do 30.9.2026.")).toEqual({ name: null, dateFrom: "2026-09-01", dateTo: "2026-09-30" });
  });

  it("finds nothing in other lines or in dates that don't exist", () => {
    expect(leafletPeriodFromText("Šifra EAN Naziv")).toBeNull();
    expect(leafletPeriodFromText("od 31.02.2026 do 10.03.2026")).toBeNull();
  });
});
