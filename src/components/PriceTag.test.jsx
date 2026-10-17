// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PriceTag from "./PriceTag.jsx";
import PrintPage from "./PrintPage.jsx";

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
