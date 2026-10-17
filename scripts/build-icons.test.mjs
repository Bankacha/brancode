import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { loadLogoFont, outlineLogoSvg, squareCorners, LOGO_SOURCE } from "./build-icons.mjs";

const source = readFileSync(LOGO_SOURCE, "utf8");
const font = loadLogoFont();

describe("outlineLogoSvg", () => {
  const out = outlineLogoSvg(source, font);

  it("replaces the font-dependent text and drops the provenance metadata", () => {
    expect(out).not.toMatch(/<text/);
    expect(out).not.toMatch(/<metadata/);
    expect(out).not.toMatch(/xmlns:c2pa/);
  });

  it("draws both clipped halves of the b as white paths", () => {
    const paths = out.match(/<path [^>]*clip-path="url\(#[tb]\)"[^>]*>/g) ?? [];
    expect(paths).toHaveLength(2);
    expect(paths.some((p) => p.includes('clip-path="url(#t)"'))).toBe(true);
    expect(paths.some((p) => p.includes('clip-path="url(#b)"'))).toBe(true);
    for (const p of paths) expect(p).toContain('fill="#FFFFFF"');
  });

  it("keeps the camera corners and the scan line", () => {
    expect(out).toContain('stroke="#1D3B2A"');
    expect(out).toMatch(/<rect x="1" y="26.4"/);
  });
});

describe("squareCorners", () => {
  it("squares the orange tile of the real logo, not the clip rects before it", () => {
    const square = squareCorners(outlineLogoSvg(source, font));
    expect(square).toContain('<rect width="48" height="48" rx="0" fill="#D9502B">');
    expect(square).toContain('rx="0.6"');
  });

  it("squares only the background corners", () => {
    expect(squareCorners('<rect width="48" height="48" rx="11" fill="#D9502B"></rect><rect x="1" rx="0.6"></rect>')).toBe(
      '<rect width="48" height="48" rx="0" fill="#D9502B"></rect><rect x="1" rx="0.6"></rect>'
    );
  });
});
