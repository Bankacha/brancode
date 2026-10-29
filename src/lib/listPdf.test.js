import { describe, it, expect } from "vitest";
import { inventoryPdfDefinition, inventoryPdfFilename, requisitionPdfDefinition, requisitionPdfFilename } from "./listPdf.js";

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
    expect(inventoryPdfFilename(popis)).toBe("popis-01.10.2026-18.10.2026.pdf");
  });
});

describe("requisitionPdfDefinition", () => {
  const trebovanje = { id: "t1", title: "Pekara", date: "2026-10-18" };
  const rows = [
    { id: "a", barcode: "111", name: "Mleko", price: 100, quantity: 3 },
    { id: "b", barcode: null, name: "Hleb za sendviče", price: null, quantity: null },
  ];
  const def = () => requisitionPdfDefinition(trebovanje, rows, new Date(2026, 9, 18, 9, 0));

  it("names the trebovanje and its date on top", () => {
    const top = JSON.stringify(def().content.filter((node) => !node.table));
    expect(top).toContain("Trebovanje · Pekara");
    expect(top).toContain("Datum: 18.10.2026");
    expect(top).toContain("2 stavke");
  });

  it("has name, barcode, price, quantity and an empty box to tick on each row, header on every page", () => {
    const t = table(def());
    expect(t.headerRows).toBe(1);
    expect(t.body[0].map((cell) => cell.text)).toEqual(["Naziv", "Barkod", "Cena", "Količina", ""]);
    const [, mleko, hleb] = t.body;
    expect(mleko.slice(0, 4).map((cell) => cell.text ?? cell)).toEqual(["Mleko", "111", "100,00", "3"]);
    expect(hleb.slice(0, 4).map((cell) => cell.text ?? cell)).toEqual(["Hleb za sendviče", "", "", ""]);
    expect(mleko[4].canvas[0]).toMatchObject({ type: "rect" });
  });

  describe("with leaflets", () => {
    const running = { leafletId: "L1", promoPrice: 99.99, dateFrom: "2026-09-25", dateTo: "2026-10-31", upcoming: false };
    const upcoming = { leafletId: "L2", promoPrice: 89.99, dateFrom: "2026-11-01", dateTo: "2026-11-30", upcoming: true };
    const withLeaflets = () =>
      table(
        requisitionPdfDefinition(
          trebovanje,
          [
            { ...rows[0], onLeaflet: true, leaflets: [running] },
            { ...rows[0], id: "c", name: "Jogurt", onLeaflet: true, leaflets: [running, upcoming] },
            { ...rows[1], leaflets: [] },
          ],
          new Date(2026, 9, 18, 9, 0)
        )
      );
    const texts = (cell) => cell.stack.map((entry) => entry.stack.map((line) => (Array.isArray(line.text) ? line.text.map((t) => t.text).join("") : line.text)));

    it("adds an Akcija column with the leaflet price and until when it lasts", () => {
      const t = withLeaflets();
      expect(t.widths).toEqual(["*", 80, 50, 96, 44, 24]);
      expect(t.body[0].map((cell) => cell.text)).toEqual(["Naziv", "Barkod", "Cena", "Akcija", "Količina", ""]);
      expect(texts(t.body[1][3])).toEqual([["Liflet 99,99", "do 31.10."]]);
    });

    it("lists both leaflets, the upcoming one with a USKORO mark and its start", () => {
      const cell = withLeaflets().body[2][3];
      expect(texts(cell)).toEqual([
        ["Liflet 99,99", "do 31.10."],
        ["Liflet 89,99  USKORO ", "od 01.11. do 30.11."],
      ]);
      const marks = cell.stack.flatMap((entry) => entry.stack[0].text).filter((t) => t.background);
      expect(marks).toEqual([expect.objectContaining({ text: " USKORO ", background: "#111111", color: "#ffffff" })]);
    });

    it("shades a leaflet row with a bold name and a plain price, without LIFLET over it", () => {
      const [, mleko, , hleb] = withLeaflets().body;
      expect(mleko[0]).toMatchObject({ text: "Mleko", bold: true, fillColor: "#e4e4e4" });
      expect(mleko[2]).toEqual({ text: "100,00", alignment: "right", fillColor: "#e4e4e4" });
      expect(hleb.some((cell) => cell?.fillColor)).toBe(false);
      expect(hleb[3]).toEqual({ text: "" });
    });
  });

  it("has no Akcija column when no article is on a leaflet", () => {
    const t = table(def());
    expect(t.widths).toEqual(["*", 88, 60, 52, 24]);
    expect(t.body[0]).toHaveLength(5);
  });

  it("draws its own box on every row (pdfmake draws a shared canvas only once)", () => {
    const t = table(requisitionPdfDefinition(trebovanje, [rows[0], rows[1], { ...rows[0], id: "c" }], new Date(2026, 9, 18, 9, 0)));
    const boxes = t.body.slice(1).map((row) => row[4]);
    expect(new Set(boxes).size).toBe(3);
    expect(new Set(boxes.map((box) => box.canvas)).size).toBe(3);
  });

  it("gives a bigger box to tick with a pen", () => {
    const t = table(def());
    expect(t.widths.at(-1)).toBe(24);
    expect(t.body[1][4].canvas[0]).toMatchObject({ type: "rect", w: 14, h: 14 });
  });

  it("names the file after the date", () => {
    expect(requisitionPdfFilename(trebovanje)).toBe("trebovanje-18.10.2026.pdf");
  });
});
