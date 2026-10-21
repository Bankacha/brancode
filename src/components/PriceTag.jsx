import { useLayoutEffect, useMemo, useRef, useState } from "react";
import "@fontsource/oswald/400.css";
import "@fontsource/barlow-semi-condensed/700.css";
import {
  PRICE_TAG_STYLES,
  barcodeImageBox,
  makeBarcodeDataUrl,
  makePromoLineDataUrl,
  makeSideBarcodeDataUrl,
  priceParts,
  promoLineBox,
  promoLineText,
  shrinkFontPt,
  sideBarcodeBox,
  tagGeometry,
} from "../lib/priceTags.js";
import { formatPrice } from "../lib/format.js";

// The printed tag, drawn from the same settings as the Excel export, in real
// millimetres and points (dimensions are computed, hence inline styles).
// Bahnschrift exists on the Windows PC that prints; phones fall back to the
// closest open font.
const NAME_FONT = "'Bahnschrift SemiBold', 'Bahnschrift', 'Barlow Semi Condensed', sans-serif";
const PRICE_FONT = "'Oswald', sans-serif";
const PX_PER_MM = 96 / 25.4;

// Excel on Windows lays a line out with the font's winAscent above the
// baseline (Oswald: 1.325 em); at line-height 1 the browser puts the baseline
// 0.952 em down (hhea 1.193 / −0.289). A centred price comes out the same
// either way, but a top-aligned one (fridge) prints this much lower.
const EXCEL_TOP_ALIGN_OFFSET_EM = 0.373;

const justify = { left: "flex-start", center: "center", right: "flex-end" };
const align = { top: "flex-start", middle: "center", bottom: "flex-end" };
const box = (alignment, heightMm) => ({
  display: "flex",
  justifyContent: justify[alignment.horizontal],
  alignItems: align[alignment.vertical],
  height: `${heightMm.toFixed(2)}mm`,
  overflow: "hidden",
});

export function NameCell({ name, format }) {
  const style = PRICE_TAG_STYLES[format];
  const { nameHeightMm, columnWidthsMm } = tagGeometry(format);
  return (
    <td colSpan={columnWidthsMm.length} className="border border-black p-0 align-top" style={{ height: `${nameHeightMm.toFixed(2)}mm` }}>
      <div
        style={{
          ...box(style.nameAlignment, nameHeightMm),
          fontFamily: NAME_FONT,
          fontWeight: 700,
          fontSize: `${style.nameFontSize}pt`,
          lineHeight: 1.15,
          textAlign: "center",
          overflowWrap: "anywhere",
          padding: "0 2px",
        }}
      >
        {name}
      </div>
    </td>
  );
}

// Shelf and fridge prices print the decimals at half size, raised to the top
// (Excel: superscript rich text), beside the barcode column — so the price
// shrinks to fit its own column, not the whole tag.
const drawnPromoLines = new Map();
const cachedPromoLine = (text, placement) => {
  const key = `${text}|${placement.widthMm}x${placement.heightMm}`;
  if (!drawnPromoLines.has(key)) drawnPromoLines.set(key, makePromoLineDataUrl(text, placement));
  return drawnPromoLines.get(key);
};

// A leaflet article's "Akcija važi do …", where the export puts it: over the
// top of the price cell, without moving the price.
function PromoLine({ dateTo, format, promoLineImage = cachedPromoLine }) {
  const placement = promoLineBox(format);
  const text = promoLineText(dateTo);
  const src = useMemo(() => {
    try {
      return promoLineImage(text, placement);
    } catch (e) {
      return null; // no canvas; the tag still renders
    }
  }, [promoLineImage, text, format]); // placement follows from format
  if (!src) return null;
  return (
    <img
      src={src}
      alt={text}
      className="absolute"
      style={{ left: `${placement.leftMm}mm`, top: `${placement.topMm}mm`, width: `${placement.widthMm}mm`, height: `${placement.heightMm}mm` }}
    />
  );
}

export function PriceCell({ price, format, promoUntil, promoLineImage }) {
  const style = PRICE_TAG_STYLES[format];
  const { priceHeightMm, priceWidthMm } = tagGeometry(format);
  const side = style.barcode === "side";
  const text = formatPrice(price);
  const basePt = style.priceFontSize(text);
  const [fontPt, setFontPt] = useState(basePt);
  const textRef = useRef(null);

  // Excel's shrink-to-fit. Text width scales with font size, so the width at
  // the full size is derived from the size currently drawn — the DOM is never
  // written behind React's back. Measured again once the print font loads.
  useLayoutEffect(() => {
    const el = textRef.current;
    let cancelled = false;
    const measure = () => {
      if (cancelled || !el) return;
      const drawnPt = parseFloat(el.style.fontSize) || basePt;
      const widthAtBasePx = (el.offsetWidth * basePt) / drawnPt; // layout width: not 0 like an inline scrollWidth, not scaled like a bounding rect
      setFontPt(shrinkFontPt(basePt, widthAtBasePx, priceWidthMm * PX_PER_MM));
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => {
      cancelled = true;
    };
  }, [basePt, text, priceWidthMm]);

  const { whole, decimals } = priceParts(price);
  return (
    <td className={`relative border border-black p-0 align-top ${side ? "border-r-0" : ""}`} style={{ height: `${priceHeightMm.toFixed(2)}mm` }}>
      {promoUntil && <PromoLine dateTo={promoUntil} format={format} promoLineImage={promoLineImage} />}
      <div
        style={{
          ...box(style.priceAlignment, priceHeightMm),
          ...(style.priceAlignment.vertical === "top" && { paddingTop: `${+(EXCEL_TOP_ALIGN_OFFSET_EM * fontPt).toFixed(3)}pt`, boxSizing: "border-box" }),
          fontFamily: PRICE_FONT,
          fontWeight: 400,
          lineHeight: 1,
        }}
      >
        <span ref={textRef} style={{ fontSize: `${fontPt}pt`, whiteSpace: "nowrap" }}>
          {side ? (
            <>
              <span>{whole}</span>
              <span style={{ fontSize: "0.5em", verticalAlign: "top" }}>{decimals}</span>
            </>
          ) : (
            text
          )}
        </span>
      </div>
    </td>
  );
}

// Drawing a barcode is a canvas render; the same codes come back on every
// page turn and format switch.
const drawnBarcodes = new Map();
const cachedBarcode = (code) => {
  if (!drawnBarcodes.has(code)) drawnBarcodes.set(code, makeBarcodeDataUrl(code));
  return drawnBarcodes.get(code);
};

export function BarcodeCell({ code, format, barcodeImage = cachedBarcode }) {
  const { barcodeHeightMm } = tagGeometry(format);
  const placement = barcodeImageBox(format);
  const src = useMemo(() => {
    try {
      return barcodeImage(code);
    } catch (e) {
      return null; // e.g. an empty code; the tag still renders
    }
  }, [barcodeImage, code]);
  return (
    <td className="relative border border-black p-0" style={{ height: `${barcodeHeightMm.toFixed(2)}mm` }}>
      {src && (
        <img
          src={src}
          alt=""
          className="absolute"
          style={{
            left: `${placement.leftMm}mm`,
            top: `${placement.topMm}mm`,
            width: `${placement.widthMm}mm`,
            height: `${placement.heightMm}mm`,
          }}
        />
      )}
    </td>
  );
}

const drawnSideBarcodes = new Map();
const cachedSideBarcode = (code, placement) => {
  const key = `${code}|${placement.widthMm}x${placement.heightMm}`;
  if (!drawnSideBarcodes.has(key)) drawnSideBarcodes.set(key, makeSideBarcodeDataUrl(code, placement));
  return drawnSideBarcodes.get(key);
};

// The narrow column beside a shelf/fridge price with the upright barcode.
export function SideBarcodeCell({ code, format, sideBarcodeImage = cachedSideBarcode }) {
  const { priceHeightMm } = tagGeometry(format);
  const placement = sideBarcodeBox(format);
  const src = useMemo(() => {
    try {
      return sideBarcodeImage(code, placement);
    } catch (e) {
      return null; // e.g. an empty code; the tag still renders
    }
  }, [sideBarcodeImage, code, format]); // placement follows from format
  return (
    <td className="relative border border-l-0 border-black p-0" style={{ height: `${priceHeightMm.toFixed(2)}mm` }}>
      {src && (
        <img
          src={src}
          alt=""
          className="absolute"
          style={{
            left: `${placement.leftMm}mm`,
            top: `${placement.topMm}mm`,
            width: `${placement.widthMm}mm`,
            height: `${placement.heightMm}mm`,
          }}
        />
      )}
    </td>
  );
}

export const TagColumns = ({ format, count }) => {
  const { columnWidthsMm } = tagGeometry(format);
  return (
    <colgroup>
      {Array.from({ length: count }).flatMap((_, i) => columnWidthsMm.map((w, j) => <col key={`${i}-${j}`} style={{ width: `${w}mm` }} />))}
    </colgroup>
  );
};

export default function PriceTag({ item, format, barcodeImage, sideBarcodeImage, promoLineImage }) {
  return (
    // table-layout: fixed only clamps columns when the table has a width.
    <table className="table-fixed border-collapse bg-white text-black" style={{ width: `${tagGeometry(format).widthMm}mm` }}>
      <TagColumns format={format} count={1} />
      <tbody>
        <tr>
          <NameCell name={item.name} format={format} />
        </tr>
        <tr>
          <PriceCell price={item.price} format={format} promoUntil={item.promo?.dateTo} promoLineImage={promoLineImage} />
          {PRICE_TAG_STYLES[format].barcode === "side" && <SideBarcodeCell code={item.barcode} format={format} sideBarcodeImage={sideBarcodeImage} />}
        </tr>
        {PRICE_TAG_STYLES[format].barcode === "row" && (
          <tr>
            <BarcodeCell code={item.barcode} format={format} barcodeImage={barcodeImage} />
          </tr>
        )}
      </tbody>
    </table>
  );
}
