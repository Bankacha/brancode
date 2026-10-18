import { useLayoutEffect, useMemo, useRef, useState } from "react";
import "@fontsource/oswald/400.css";
import "@fontsource/barlow-semi-condensed/700.css";
import { PRICE_TAG_STYLES, barcodeImageBox, makeBarcodeDataUrl, shrinkFontPt, tagGeometry } from "../lib/priceTags.js";
import { formatPrice } from "../lib/format.js";

// The printed tag, drawn from the same settings as the Excel export, in real
// millimetres and points (dimensions are computed, hence inline styles).
// Bahnschrift exists on the Windows PC that prints; phones fall back to the
// closest open font.
const NAME_FONT = "'Bahnschrift SemiBold', 'Bahnschrift', 'Barlow Semi Condensed', sans-serif";
const PRICE_FONT = "'Oswald', sans-serif";
const PX_PER_MM = 96 / 25.4;

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
  const { nameHeightMm } = tagGeometry(format);
  return (
    <td className="border border-black p-0 align-top" style={{ height: `${nameHeightMm.toFixed(2)}mm` }}>
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

export function PriceCell({ price, format }) {
  const style = PRICE_TAG_STYLES[format];
  const { priceHeightMm, widthMm } = tagGeometry(format);
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
      const widthAtBasePx = (el.scrollWidth * basePt) / drawnPt;
      setFontPt(shrinkFontPt(basePt, widthAtBasePx, widthMm * PX_PER_MM));
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => {
      cancelled = true;
    };
  }, [basePt, text, widthMm]);

  return (
    <td className="border border-black p-0 align-top" style={{ height: `${priceHeightMm.toFixed(2)}mm` }}>
      <div style={{ ...box(style.priceAlignment, priceHeightMm), fontFamily: PRICE_FONT, fontWeight: 400, lineHeight: 1 }}>
        <span ref={textRef} style={{ fontSize: `${fontPt}pt`, whiteSpace: "nowrap" }}>
          {text}
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

export const TagColumns = ({ format, count }) => {
  const { widthMm } = tagGeometry(format);
  return (
    <colgroup>
      {Array.from({ length: count }, (_, i) => (
        <col key={i} style={{ width: `${widthMm}mm` }} />
      ))}
    </colgroup>
  );
};

export default function PriceTag({ item, format, barcodeImage }) {
  return (
    // table-layout: fixed only clamps columns when the table has a width.
    <table className="table-fixed border-collapse bg-white text-black" style={{ width: `${tagGeometry(format).widthMm}mm` }}>
      <TagColumns format={format} count={1} />
      <tbody>
        <tr>
          <NameCell name={item.name} format={format} />
        </tr>
        <tr>
          <PriceCell price={item.price} format={format} />
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
