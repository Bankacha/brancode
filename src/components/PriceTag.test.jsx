// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import PriceTag from "./PriceTag.jsx";
import PrintPage from "./PrintPage.jsx";
import { tagGeometry } from "../lib/priceTags.js";

const fakeBarcode = () => "data:image/png;base64,AAA";

describe("PriceTag", () => {
  it("prints the name and the price at the export's sizes", () => {
    render(<PriceTag item={{ name: "MAJONEZ 175", price: 1249.99, barcode: "1" }} format="shelf" />);
    const name = screen.getByText("MAJONEZ 175");
    const price = screen.getByText("1.249,99");
    expect(name.closest("td").style.height).toBe("10.05mm");
    expect(price.style.fontSize).toBe("42pt");
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
    render(<PrintPage rows={[[item(1), item(2), item(3)], [item(4), item(5), item(6)]]} format="shelf" />);
    for (const p of ["101,00", "102,00", "103,00", "104,00", "105,00", "106,00"]) expect(screen.getByText(p)).toBeTruthy();
  });
});

describe("PriceTag shrink to fit", () => {
  // jsdom has no layout: make text width proportional to its font size (and
  // length), and give it a fonts.ready promise like a browser.
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
  const fontsReady = () => Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  const textWidth = () =>
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get() {
        return parseFloat(this.style.fontSize || "0") * this.textContent.length * 0.6;
      },
    });
  afterEach(() => {
    if (original) Object.defineProperty(HTMLElement.prototype, "scrollWidth", original);
    else delete HTMLElement.prototype.scrollWidth;
    delete document.fonts;
  });

  it("stays shrunk after the print font finishes loading", async () => {
    textWidth();
    fontsReady();
    render(<PriceTag item={{ name: "VINJAK", price: 12499.99, barcode: "1" }} format="fridge" />);
    await act(async () => {
      await document.fonts.ready;
    });
    const size = parseFloat(screen.getByText("12.499,99").style.fontSize);
    expect(size).toBeLessThan(42);
    expect(size).toBeGreaterThan(30);
  });
});

describe("PriceTag width", () => {
  it("fixes the table to the column width so a long price can't widen the tag", () => {
    const { container } = render(<PriceTag item={{ name: "A", price: 12499.99, barcode: "1" }} format="fridge" />);
    expect(container.querySelector("table").style.width).toBe(`${tagGeometry("fridge").widthMm}mm`);
  });

  it("fixes an A4 grid to the width of its columns", () => {
    const { container } = render(<PrintPage rows={[[{ id: "1", name: "A", price: 1, barcode: "1" }]]} format="shelf" />);
    expect(container.querySelector("table").style.width).toBe(`${3 * tagGeometry("shelf").widthMm}mm`);
  });
});

