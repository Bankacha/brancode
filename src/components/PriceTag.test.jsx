// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import PriceTag from "./PriceTag.jsx";
import PrintPage from "./PrintPage.jsx";
import { tagGeometry } from "../lib/priceTags.js";

const fakeBarcode = () => "data:image/png;base64,AAA";

describe("PriceTag", () => {
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

