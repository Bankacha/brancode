import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  promoNoteBox,
  promoNoteLines,
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

// Excel on Windows lays a line out with the font's winDescent under the
// baseline (Oswald: 0.377 em); at line-height 1 the browser leaves 0.048 em
// (hhea 1.193 / −0.289). A centred price comes out the same either way, but a
// bottom-aligned one (fridge) prints this much higher.
const EXCEL_BOTTOM_ALIGN_OFFSET_EM = 0.329;

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
// Positions around the price are measured in Oswald, which loads after the
// first paint: until then the measurements use the fallback font, so the note
// and the barcode are measured and drawn again once it is in.
const OSWALD_FONT = '400 40px "Oswald"';
const oswaldLoaded = () => {
  try {
    return !globalThis.document?.fonts || document.fonts.check(OSWALD_FONT);
  } catch {
    return true;
  }
};
const useOswaldLoaded = () => {
  const [loaded, setLoaded] = useState(oswaldLoaded);
  useEffect(() => {
    if (loaded) return;
    let alive = true;
    const done = () => alive && setLoaded(true);
    document.fonts.load(OSWALD_FONT).then(done, done);
    return () => {
      alive = false;
    };
  }, [loaded]);
  return loaded;
};

const drawnPromoLines = new Map();
const cachedPromoLine = (lines, placement) => {
  const key = `${lines.join("/")}|${placement.widthMm}x${placement.heightMm}`;
  if (!drawnPromoLines.has(key)) drawnPromoLines.set(key, makePromoLineDataUrl(lines, placement));
  return drawnPromoLines.get(key);
};

// A leaflet article's "Akcija važi do …", where the export puts it: under the
// raised decimals of a shelf/fridge price, at the top of a fruit price.
function PromoLine({ dateTo, price, format, promoLineImage = cachedPromoLine }) {
  const fontLoaded = useOswaldLoaded();
  const under = PRICE_TAG_STYLES[format].barcode === "side";
  const placement = under ? promoNoteBox(price, format) : promoLineBox(format);
  const lines = under ? promoNoteLines(dateTo) : [promoLineText(dateTo)];
  const src = useMemo(() => {
    try {
      return promoLineImage(lines, placement);
    } catch (e) {
      return null; // no canvas; the tag still renders
    }
  }, [promoLineImage, dateTo, price, format, fontLoaded]); // lines and placement follow from these
  if (!src) return null;
  return (
    <img
      src={src}
      alt={promoLineText(dateTo)}
      className="absolute"
      style={{ left: `${placement.leftMm}mm`, top: `${placement.topMm}mm`, width: `${placement.widthMm}mm`, height: `${placement.heightMm}mm` }}
    />
  );
}

export function PriceCell({ price, format, promoUntil, promoLineImage }) {
  const style = PRICE_TAG_STYLES[format];
  const { priceHeightMm, priceWidthMm, holderHeightMm } = tagGeometry(format);
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
    <td
      className={`relative border border-black p-0 align-top ${side ? "border-r-0" : ""} ${holderHeightMm ? "border-b-0" : ""}`}
      style={{ height: `${priceHeightMm.toFixed(2)}mm` }}
    >
      {promoUntil && <PromoLine dateTo={promoUntil} price={price} format={format} promoLineImage={promoLineImage} />}
      <div
        style={{
          ...box(style.priceAlignment, priceHeightMm),
          ...(style.priceAlignment.vertical === "bottom" && { paddingBottom: `${+(EXCEL_BOTTOM_ALIGN_OFFSET_EM * fontPt).toFixed(3)}pt`, boxSizing: "border-box" }),
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

// The narrow column beside a shelf/fridge price with the upright barcode,
// which ends at the bottom of the price digits (fridge: at the holder band).
export function SideBarcodeCell({ code, price, format, sideBarcodeImage = cachedSideBarcode }) {
  const fontLoaded = useOswaldLoaded();
  const { priceHeightMm, holderHeightMm } = tagGeometry(format);
  const placement = sideBarcodeBox(format, price);
  const src = useMemo(() => {
    try {
      return sideBarcodeImage(code, placement);
    } catch (e) {
      return null; // e.g. an empty code; the tag still renders
    }
  }, [sideBarcodeImage, code, price, format, fontLoaded]); // placement follows from price, format and the font
  return (
    <td className={`relative border border-l-0 border-black p-0 ${holderHeightMm ? "border-b-0" : ""}`} style={{ height: `${priceHeightMm.toFixed(2)}mm` }}>
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

// The blank band under a fridge price, behind the holder's bottom edge.
export function HolderCell({ format }) {
  const { holderHeightMm, columnWidthsMm } = tagGeometry(format);
  return <td colSpan={columnWidthsMm.length} className="border border-t-0 border-black p-0" style={{ height: `${holderHeightMm.toFixed(2)}mm` }} />;
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
          {PRICE_TAG_STYLES[format].barcode === "side" && <SideBarcodeCell code={item.barcode} price={item.price} format={format} sideBarcodeImage={sideBarcodeImage} />}
        </tr>
        {PRICE_TAG_STYLES[format].barcode === "row" && (
          <tr>
            <BarcodeCell code={item.barcode} format={format} barcodeImage={barcodeImage} />
          </tr>
        )}
        {PRICE_TAG_STYLES[format].holderRowHeight && (
          <tr>
            <HolderCell format={format} />
          </tr>
        )}
      </tbody>
    </table>
  );
}
