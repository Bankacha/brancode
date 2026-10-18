// Builds the app logo and PWA icons from the design handoff's "Nišan" mark.
// The handoff SVG draws the letter with <text> in Bricolage Grotesque, which
// renderers without that font get wrong, so the letter is outlined to paths
// with the real font first. Run with `npm run icons`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import opentype from "opentype.js";
import resvg from "@resvg/resvg-js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const LOGO_SOURCE = `${ROOT}docs/design/redesign-handoff/assets/logo-nisan.svg`;
const FONT_FILE = `${ROOT}node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff`; // opentype.js can't read woff2

export const loadLogoFont = () => {
  const buf = readFileSync(FONT_FILE);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};

const attributes = (source) => Object.fromEntries([...source.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

export const outlineLogoSvg = (svg, font) =>
  svg
    .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
    .replace(/\s+xmlns:c2pa="[^"]*"/g, "")
    .replace(/<text ([^>]*)>([^<]*)<\/text>/g, (_, attrs, text) => {
      const a = attributes(attrs);
      const d = font.getPath(text, Number(a.x), Number(a.y), Number(a["font-size"])).toPathData(2);
      return `<path d="${d}" fill="${a.fill}" clip-path="${a["clip-path"]}"></path>`;
    });

// The orange background tile is the first <rect> drawn, i.e. the first one
// after <defs> (the rects inside <defs> are clip paths).
export const squareCorners = (svg) => {
  const drawStart = svg.includes("</defs>") ? svg.indexOf("</defs>") : 0;
  const drawn = svg.slice(drawStart).replace(/<rect\b[^>]*>/, (tag) => tag.replace(/rx="[^"]*"/, 'rx="0"'));
  return svg.slice(0, drawStart) + drawn;
};

const renderPng = (svg, size) => new resvg.Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();

const main = () => {
  const rounded = outlineLogoSvg(readFileSync(LOGO_SOURCE, "utf8"), loadLogoFont());
  // iOS rounds the apple-touch icon itself and a maskable icon must reach the
  // edges; the mark is already scaled to .62, inside the 80% safe zone.
  const square = squareCorners(rounded);

  mkdirSync(`${ROOT}src/assets`, { recursive: true });
  writeFileSync(`${ROOT}src/assets/logo.svg`, rounded);
  const icons = [
    ["favicon-32.png", rounded, 32],
    ["icon-192.png", rounded, 192],
    ["icon-512.png", rounded, 512],
    ["apple-touch-icon.png", square, 180],
    ["icon-maskable-512.png", square, 512],
  ];
  for (const [name, svg, size] of icons) writeFileSync(`${ROOT}public/${name}`, renderPng(svg, size));
  console.log(`wrote src/assets/logo.svg and ${icons.length} icons in public/`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
