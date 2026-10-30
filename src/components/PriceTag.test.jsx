// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import PriceTag from "./PriceTag.jsx";
import PrintPage from "./PrintPage.jsx";
import { promoNoteBox, sideBarcodeBox, tagGeometry } from "../lib/priceTags.js";

const fakeBarcode = () => "data:image/png;base64,AAA";

describe("PriceTag once Oswald has loaded", () => {
  afterEach(() => {
    delete document.fonts;
  });

  it("draws the promo note and the upright barcode again with the real font's widths", async () => {
    let loaded;
    const fontLoad = new Promise((resolve) => (loaded = resolve)); // every caller waits on the same load
    document.fonts = { check: () => false, load: () => fontLoad, ready: new Promise(() => {}) };
    const promoLineImage = vi.fn(() => "data:image/png;base64,AAA");
    const sideBarcodeImage = vi.fn(() => "data:image/png;base64,AAA");
    const promo = { dateFrom: "2026-09-25", dateTo: "2026-10-31" };
    render(<PriceTag item={{ name: "A", price: 99, barcode: "1", promo }} format="shelf" sideBarcodeImage={sideBarcodeImage} promoLineImage={promoLineImage} />);
    expect(promoLineImage).toHaveBeenCalledTimes(1);
    expect(sideBarcodeImage).toHaveBeenCalledTimes(1);
    await act(async () => loaded());
    expect(promoLineImage).toHaveBeenCalledTimes(2);
    expect(sideBarcodeImage).toHaveBeenCalledTimes(2);
  });
});

describe("PriceTag", () => {
  it("shows a leaflet article's promo line over the price, and nothing for others", () => {
    const promo = { dateFrom: "2026-09-25", dateTo: "2026-10-31" };
    const { container, rerender } = render(
      <PriceTag item={{ name: "A", price: 99, barcode: "1", promo }} format="shelf" sideBarcodeImage={fakeBarcode} promoLineImage={fakeBarcode} />
    );
    const line = screen.getByAltText("Akcija važi do 31.10.2026.");
    expect(line.closest("td").textContent).toContain("99");
    expect(line.style.left).toBe(`${promoNoteBox(99, "shelf").leftMm}mm`); // under the decimals, where Excel puts it
    rerender(<PriceTag item={{ name: "A", price: 99, barcode: "1" }} format="shelf" sideBarcodeImage={fakeBarcode} promoLineImage={fakeBarcode} />);
    expect(container.querySelector('img[alt^="Akcija"]')).toBeNull();
  });

  it("keeps a fruit tag's promo line at the top of the price cell", () => {
    const promo = { dateFrom: "2026-09-25", dateTo: "2026-10-31" };
    render(<PriceTag item={{ name: "Banane", price: 159, barcode: "1", promo }} format="fruit" barcodeImage={fakeBarcode} promoLineImage={fakeBarcode} />);
    expect(screen.getByAltText("Akcija važi do 31.10.2026.").style.top).toBe("0.7mm");
  });

  it("ends the upright barcode at the bottom of the price", () => {
    const { container } = render(<PriceTag item={{ name: "A", price: 99, barcode: "8600005000108" }} format="fridge" sideBarcodeImage={fakeBarcode} />);
    const box = sideBarcodeBox("fridge", 99);
    expect(container.querySelector('img[alt=""]').style.height).toBe(`${box.heightMm}mm`);
  });

  it("prints the name and the price at the export's sizes", () => {
    render(<PriceTag item={{ name: "MAJONEZ 175", price: 1249.99, barcode: "1" }} format="shelf" sideBarcodeImage={fakeBarcode} />);
    const name = screen.getByText("MAJONEZ 175");
    expect(name.closest("td").style.height).toBe("10.05mm");
    expect(screen.getByText("1.249").parentElement.style.fontSize).toBe("42pt");
  });

  it("draws shelf decimals at half size, raised to the top", () => {
    render(<PriceTag item={{ name: "A", price: 1249.99, barcode: "1" }} format="shelf" sideBarcodeImage={fakeBarcode} />);
    const decimals = screen.getByText(",99");
    expect(decimals.style.fontSize).toBe("0.5em");
    expect(decimals.style.verticalAlign).toBe("top");
  });

  it("puts a bottom-aligned (fridge) price as high as Excel does, a centered one where it was", () => {
    render(<PriceTag item={{ name: "A", price: 99, barcode: "1" }} format="fridge" sideBarcodeImage={fakeBarcode} />);
    expect(screen.getByText("99").parentElement.parentElement.style.paddingBottom).toBe("13.818pt");
    render(<PriceTag item={{ name: "B", price: 98, barcode: "1" }} format="shelf" sideBarcodeImage={fakeBarcode} />);
    expect(screen.getByText("98").parentElement.parentElement.style.paddingBottom).toBe("");
  });

  it("draws the blank band under a fridge price, inside the outline with no line above it", () => {
    const { container } = render(<PriceTag item={{ name: "A", price: 99, barcode: "1" }} format="fridge" sideBarcodeImage={fakeBarcode} />);
    const rows = container.querySelectorAll("tr");
    expect(rows).toHaveLength(3);
    const [band] = rows[2].querySelectorAll("td");
    expect(band.colSpan).toBe(2);
    expect(band.style.height).toBe(`${tagGeometry("fridge").holderHeightMm.toFixed(2)}mm`);
    expect(band.className).toContain("border-t-0");
    rows[1].querySelectorAll("td").forEach((td) => expect(td.className).toContain("border-b-0"));
  });

  it("draws the band on every fridge tag of an A4 page, and none under a shelf price", () => {
    const tag = (id) => ({ id, name: id, price: 1, barcode: "1" });
    const { container, rerender } = render(<PrintPage rows={[[tag("a"), tag("b")], [tag("c")]]} format="fridge" sideBarcodeImage={fakeBarcode} />);
    expect(container.querySelectorAll("tr")).toHaveLength(6);
    expect(container.querySelectorAll("tr")[2].querySelectorAll("td")).toHaveLength(2);
    rerender(<PrintPage rows={[[tag("a"), tag("b")], [tag("c")]]} format="shelf" sideBarcodeImage={fakeBarcode} />);
    expect(container.querySelectorAll("tr")).toHaveLength(4);
  });

  it("keeps fruit prices in one piece", () => {
    render(<PriceTag item={{ name: "Banane", price: 159, barcode: "1" }} format="fruit" barcodeImage={fakeBarcode} />);
    expect(screen.getByText("159,00").style.fontSize).toBe("62pt");
  });

  it("spans the name over the price and barcode columns", () => {
    render(<PriceTag item={{ name: "MAJONEZ", price: 1, barcode: "1" }} format="fridge" sideBarcodeImage={fakeBarcode} />);
    expect(screen.getByText("MAJONEZ").closest("td").colSpan).toBe(2);
  });

  it("puts the upright barcode beside the shelf price, with no line between them", () => {
    const { container } = render(<PriceTag item={{ name: "A", price: 99, barcode: "8600005000108" }} format="shelf" sideBarcodeImage={fakeBarcode} />);
    const img = container.querySelector("img");
    expect(img.getAttribute("src")).toBe("data:image/png;base64,AAA");
    const [priceTd, barcodeTd] = img.closest("tr").querySelectorAll("td");
    expect(barcodeTd.contains(img)).toBe(true);
    expect(priceTd.className).toContain("border-r-0");
    expect(barcodeTd.className).toContain("border-l-0");
  });

  it("still renders a shelf tag whose barcode can't be drawn", () => {
    const { container } = render(<PriceTag item={{ name: "A", price: 99, barcode: "" }} format="shelf" sideBarcodeImage={() => { throw new Error("no canvas"); }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("99")).toBeTruthy();
  });

  it("clips a long name inside its cell instead of growing the tag", () => {
    render(<PriceTag item={{ name: "VEOMA DUGACAK NAZIV ARTIKLA KOJI SE NE UKLAPA U DVA REDA NA CENOVNIKU", price: 99, barcode: "1" }} format="shelf" />);
    expect(screen.getByText(/VEOMA DUGACAK/).style.overflow).toBe("hidden");
  });

  it("adds the barcode image on fruit tags", () => {
    const { container } = render(<PriceTag item={{ name: "Banane", price: 159, barcode: "2000000001232" }} format="fruit" barcodeImage={fakeBarcode} />);
    expect(container.querySelector("img").getAttribute("src")).toBe("data:image/png;base64,AAA");
  });

  it("still renders when a barcode can't be drawn", () => {
    render(<PriceTag item={{ name: "Banane", price: 159, barcode: "" }} format="fruit" barcodeImage={() => { throw new Error("no canvas"); }} />);
    expect(screen.getByText("159,00")).toBeTruthy();
  });
});

describe("PrintPage", () => {
  it("lays out a page of tags in one grid", () => {
    const item = (i) => ({ id: `${i}`, name: `A${i}`, price: 100 + i, barcode: `${i}` });
    const { container } = render(<PrintPage rows={[[item(1), item(2), item(3)], [item(4), item(5), item(6)]]} format="shelf" sideBarcodeImage={fakeBarcode} />);
    for (const p of ["101", "102", "103", "104", "105", "106"]) expect(screen.getByText(p)).toBeTruthy();
    expect(container.querySelectorAll("col")).toHaveLength(6);
    expect(container.querySelectorAll("img")).toHaveLength(6);
  });
});

describe("PriceTag shrink to fit", () => {
  // jsdom has no layout: make text width proportional to its font size (and
  // length), and give it a fonts.ready promise like a browser.
  // Like a browser: the laid-out width of the text, before the preview's
  // scale transform (a bounding rect would be scaled; an inline span's
  // scrollWidth is 0 in Chromium).
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  const fontsReady = () => Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  const textWidth = () =>
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        return parseFloat(this.style.fontSize || "0") * this.textContent.length * 0.6;
      },
    });
  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", original);
    delete document.fonts;
  });

  it("stays shrunk after the print font finishes loading", async () => {
    textWidth();
    fontsReady();
    render(<PriceTag item={{ name: "VINJAK", price: 12499.99, barcode: "1" }} format="fridge" sideBarcodeImage={fakeBarcode} />);
    await act(async () => {
      await document.fonts.ready;
    });
    const size = parseFloat(screen.getByText("12.499").parentElement.style.fontSize);
    expect(size).toBeLessThan(42);
    expect(size).toBeGreaterThan(25);
  });

  it("fits the shelf price into its own column, not the whole tag width", async () => {
    textWidth();
    fontsReady();
    // "219,00" at 50 pt measures 180 px here: it fit the old 187 px cell, but
    // the price column is now 152 px.
    render(<PriceTag item={{ name: "A", price: 219, barcode: "1" }} format="shelf" sideBarcodeImage={fakeBarcode} />);
    await act(async () => {
      await document.fonts.ready;
    });
    expect(parseFloat(screen.getByText("219").parentElement.style.fontSize)).toBeLessThan(50);
  });
});

describe("PriceTag width", () => {
  it("fixes the table to the column width so a long price can't widen the tag", () => {
    const { container } = render(<PriceTag item={{ name: "A", price: 12499.99, barcode: "1" }} format="fridge" sideBarcodeImage={fakeBarcode} />);
    expect(container.querySelector("table").style.width).toBe(`${tagGeometry("fridge").widthMm}mm`);
  });

  it("fixes an A4 grid to the width of its columns", () => {
    const { container } = render(<PrintPage rows={[[{ id: "1", name: "A", price: 1, barcode: "1" }]]} format="shelf" sideBarcodeImage={fakeBarcode} />);
    expect(container.querySelector("table").style.width).toBe(`${3 * tagGeometry("shelf").widthMm}mm`);
  });
});

