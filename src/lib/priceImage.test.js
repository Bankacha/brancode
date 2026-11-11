// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { makePriceDataUrl, priceLayout, priceParts } from "./priceTags.js";

// A 2D context that records what is drawn where, in canvas px.
const recordDrawing = () => {
  const drawn = [];
  const ctx = { fillText: (text, x, y) => drawn.push({ text, x, y, font: ctx.font }), measureText: (text) => ({ width: text.length * 20 }) };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,P");
  return drawn;
};

describe("makePriceDataUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete document.fonts;
  });

  it("draws the digits and the raised decimals where the layout puts them", () => {
    document.fonts = { check: () => true };
    const drawn = recordDrawing();
    expect(makePriceDataUrl(695, "fridge")).toBe("data:image/png;base64,P");
    const layout = priceLayout(695, "fridge");
    const em = layout.fontPt * (25.4 / 72);
    const px = (mm) => mm * 16;
    const [whole, decimals] = drawn;
    expect(whole).toMatchObject({ text: priceParts(695).whole });
    expect(whole.x).toBeCloseTo(px(layout.textLeftMm), 5);
    expect(whole.y).toBeCloseTo(px(layout.baselineMm), 5);
    expect(whole.font).toBe(`400 ${px(em)}px Oswald`);
    expect(decimals).toMatchObject({ text: ",00" });
    expect(decimals.x).toBeCloseTo(px(layout.textLeftMm + layout.wholeMm), 5);
    expect(decimals.y).toBeCloseTo(px(layout.capTopMm + 0.81 * 0.5 * em), 5);
  });

  it("refuses to draw before Oswald is in, so the cell gets the price as text", () => {
    document.fonts = { check: () => false };
    recordDrawing();
    expect(() => makePriceDataUrl(695, "fridge")).toThrow();
  });
});
