import { describe, it, expect } from "vitest";
import { orderForPdf, parseStoredPdfOrder } from "./pdfOrder.js";

const item = (name, createdAt) => ({ id: name, name, createdAt });

describe("orderForPdf", () => {
  it("sorts by name the Serbian way: č and ć after c, dž and đ after d, lj after l, numbers as numbers", () => {
    const items = ["Šećer", "čaj", "Cimet", "ajvar", "Ćevapi", "Džem", "Dunja", "Đumbir", "Ljuta", "Lubenica", "Mleko 10", "Mleko 2"].map((n) => item(n, "x"));
    expect(orderForPdf(items, "name").map((i) => i.name)).toEqual([
      "ajvar", "Cimet", "čaj", "Ćevapi", "Dunja", "Džem", "Đumbir", "Lubenica", "Ljuta", "Mleko 2", "Mleko 10", "Šećer",
    ]);
  });

  it("lists items in the order they were added, the first one first", () => {
    const newestFirst = [item("C", "2026-10-18T10:02:00Z"), item("B", "2026-10-18T10:01:00Z"), item("A", "2026-10-18T10:00:00Z")];
    expect(orderForPdf(newestFirst, "added").map((i) => i.name)).toEqual(["A", "B", "C"]);
  });

  it("doesn't change the list it was given", () => {
    const items = [item("B", "2"), item("A", "1")];
    orderForPdf(items, "name");
    expect(items.map((i) => i.name)).toEqual(["B", "A"]);
  });
});

describe("parseStoredPdfOrder", () => {
  it("sorts by name unless something else was chosen on this phone", () => {
    expect(parseStoredPdfOrder(null)).toEqual({ popis: "name", trebovanje: "name" });
    expect(parseStoredPdfOrder('{"trebovanje":"added"}')).toEqual({ popis: "name", trebovanje: "added" });
    expect(parseStoredPdfOrder('{"popis":"nonsense"}')).toEqual({ popis: "name", trebovanje: "name" });
    expect(parseStoredPdfOrder("not json")).toEqual({ popis: "name", trebovanje: "name" });
  });
});
