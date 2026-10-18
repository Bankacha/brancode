import { describe, it, expect } from "vitest";
import { inventoryPdfDefinition, inventoryPdfFilename } from "./listPdf.js";

const popis = { id: "p1", title: "Magacin", dateFrom: "2026-10-01", dateTo: "2026-10-18" };
const items = [
  { id: "a", barcode: "8600005000122", name: "Čokolada ćevap šljiva žuta đak", price: 1249.99, quantity: 2 },
  { id: "b", barcode: "12345", name: "Hleb", price: 79.5, quantity: 1.5 },
];
const definition = () => inventoryPdfDefinition(popis, items, new Date(2026, 9, 18, 21, 0));
const table = (def) => def.content.find((node) => node.table).table;

describe("inventoryPdfDefinition", () => {
  it("is an A4 portrait page with the popis named, its period, the date it was made and the item count on top", () => {
    const def = definition();
    expect(def.pageSize).toBe("A4");
    expect(def.pageOrientation).toBe("portrait");
    const top = JSON.stringify(def.content.filter((node) => !node.table));
    expect(top).toContain("Popis · Magacin");
    expect(top).toContain("01.10.2026 – 18.10.2026");
    expect(top).toContain("Izrađeno 18.10.2026");
    expect(top).toContain("2 stavke");
  });

  it("repeats the table header on every page", () => {
    const t = table(definition());
    expect(t.headerRows).toBe(1);
    expect(t.body[0].map((cell) => cell.text)).toEqual(["#", "Naziv", "Barkod", "Cena", "Količina"]);
  });

  it("numbers the rows and prints prices and quantities the Serbian way, names untouched", () => {
    const [, first, second] = table(definition()).body;
    expect(first.map((cell) => cell.text ?? cell)).toEqual(["1", "Čokolada ćevap šljiva žuta đak", "8600005000122", "1.249,99", "2"]);
    expect(second.map((cell) => cell.text ?? cell)).toEqual(["2", "Hleb", "12345", "79,50", "1,5"]);
  });

  it("says which page of how many in the footer", () => {
    expect(JSON.stringify(definition().footer(2, 5))).toContain("Strana 2 od 5");
  });
});

describe("inventoryPdfFilename", () => {
  it("names the file after the period", () => {
    expect(inventoryPdfFilename(popis)).toBe("popis-2026-10-01_2026-10-18.pdf");
  });
});
