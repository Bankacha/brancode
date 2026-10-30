import { Fragment } from "react";
import { PAGE_MARGINS_IN, PRICE_TAG_STYLES, tagGeometry } from "../lib/priceTags.js";
import { BarcodeCell, HolderCell, NameCell, PriceCell, SideBarcodeCell, TagColumns } from "./PriceTag.jsx";

const MM_PER_IN = 25.4;

// One A4 sheet as Excel prints it: tags from the top-left margin, in one grid
// so neighbouring tags share their border lines.
export default function PrintPage({ rows, format, barcodeImage, sideBarcodeImage, promoLineImage }) {
  const style = PRICE_TAG_STYLES[format];
  return (
    <div
      className="box-border bg-white text-black shadow-paper"
      style={{ width: "210mm", height: "297mm", paddingTop: `${PAGE_MARGINS_IN.top * MM_PER_IN}mm`, paddingLeft: `${PAGE_MARGINS_IN.left * MM_PER_IN}mm` }}
    >
      <table className="table-fixed border-collapse" style={{ width: `${style.columns * tagGeometry(format).widthMm}mm` }}>
        <TagColumns format={format} count={style.columns} />
        <tbody>
          {rows.map((row, r) => (
            <Fragment key={r}>
              <tr>
                {row.map((item) => (
                  <NameCell key={item.id} name={item.name} format={format} />
                ))}
              </tr>
              <tr>
                {row.map((item) => (
                  <Fragment key={item.id}>
                    <PriceCell price={item.price} format={format} promoUntil={item.promo?.dateTo} promoLineImage={promoLineImage} />
                    {style.barcode === "side" && <SideBarcodeCell code={item.barcode} price={item.price} format={format} sideBarcodeImage={sideBarcodeImage} />}
                  </Fragment>
                ))}
              </tr>
              {style.barcode === "row" && (
                <tr>
                  {row.map((item) => (
                    <BarcodeCell key={item.id} code={item.barcode} format={format} barcodeImage={barcodeImage} />
                  ))}
                </tr>
              )}
              {style.holderRowHeight && (
                <tr>
                  {row.map((item) => (
                    <HolderCell key={item.id} format={format} />
                  ))}
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
