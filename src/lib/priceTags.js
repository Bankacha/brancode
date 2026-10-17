import ExcelJS from "exceljs";
import JsBarcode from "jsbarcode";
import { formatPrice } from "./format.js";

// Fridge price holders cover the top and bottom of the printed strip, so only a
// middle band is visible — the fridge preset adds blank space above the name
// (pushed out of view) and pulls both lines snug against the divider between
// them (the part that stays visible), instead of centering them.
const MM_TO_PT = 2.834645669;
const FRIDGE_TOP_BUFFER_MM = 1; // blank space above the name, hidden behind the holder's top edge
const FRIDGE_BOTTOM_BUFFER_MM = 5; // blank space below the price digit, hidden behind the holder's bottom edge
// Always give the fridge name row the extra headroom a wrapped 2-line name
// would need — simpler and more consistent than only adding it for long names.
const FRIDGE_EXTRA_TOP_MM = 4;
const FRIDGE_PRICE_FONT_SIZE = 42; // always the "over 1000 din" size, for a consistent look

// Fruit tags are much bigger (~6cm total) and print 2 per row instead of 3,
// with a scannable barcode image in a 3rd row below the price.
const FRUIT_NAME_HEIGHT_MM = 18;
const FRUIT_PRICE_HEIGHT_MM = 29;
const FRUIT_BARCODE_HEIGHT_MM = 13;
const FRUIT_NAME_FONT_SIZE = 22;
const FRUIT_PRICE_FONT_SIZE = () => 62; // always the "over 1000 din" size, for a consistent look
const FRUIT_BARCODE_WIDTH_FRACTION = 0.83; // fraction of the column width the barcode image uses, centered

export const PRICE_TAG_STYLES = {
  shelf: {
    label: "Cene za rafove",
    fileSlug: "raf",
    columns: 3,
    columnWidth: 26.75,
    nameRowHeight: 28.5,
    priceRowHeight: 77.25,
    nameFontSize: 12,
    nameAlignment: { horizontal: "center", vertical: "middle", wrapText: true },
    priceAlignment: { horizontal: "center", vertical: "middle", shrinkToFit: true },
    priceFontSize: (priceText) => {
      if (priceText.length <= 6) return 50; // e.g. "219,00"
      if (priceText.length <= 8) return 42; // e.g. "1.249,99"
      return 34; // e.g. "12.499,99" or longer
    },
    hasBarcode: false,
  },
  fridge: {
    label: "Cene za frižider",
    fileSlug: "frizider",
    columns: 3,
    columnWidth: 26.75,
    nameRowHeight: 28.5 + (FRIDGE_TOP_BUFFER_MM + FRIDGE_EXTRA_TOP_MM) * MM_TO_PT,
    priceRowHeight: 77.25 + FRIDGE_BOTTOM_BUFFER_MM * MM_TO_PT - FRIDGE_EXTRA_TOP_MM * MM_TO_PT,
    nameFontSize: 12,
    nameAlignment: { horizontal: "center", vertical: "bottom", wrapText: true },
    priceAlignment: { horizontal: "center", vertical: "top", shrinkToFit: true },
    priceFontSize: () => FRIDGE_PRICE_FONT_SIZE,
    hasBarcode: false,
  },
  fruit: {
    label: "Cene za voće",
    fileSlug: "voce",
    columns: 2,
    columnWidth: 40,
    nameRowHeight: FRUIT_NAME_HEIGHT_MM * MM_TO_PT,
    priceRowHeight: FRUIT_PRICE_HEIGHT_MM * MM_TO_PT,
    barcodeRowHeight: FRUIT_BARCODE_HEIGHT_MM * MM_TO_PT,
    nameFontSize: FRUIT_NAME_FONT_SIZE,
    nameAlignment: { horizontal: "center", vertical: "middle", wrapText: true },
    priceAlignment: { horizontal: "center", vertical: "middle", shrinkToFit: true },
    priceFontSize: FRUIT_PRICE_FONT_SIZE,
    hasBarcode: true,
  },
};

export const A4_HEIGHT_PT = 841.89;
export const PAGE_MARGINS_IN = { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }; // Excel's defaults
const PAGE_FIT_SAFETY_PT = 4; // slack for printer/renderer rounding

// Excel paginates purely by height, so a tag's name row can land on one
// sheet and its price on the next — breaks go before any tag row that
// wouldn't fit whole on the current page.
export const tagRowsPerPage = (format) => {
  const style = PRICE_TAG_STYLES[format];
  const tagHeightPt = style.nameRowHeight + style.priceRowHeight + (style.barcodeRowHeight ?? 0);
  const usableHeightPt = A4_HEIGHT_PT - (PAGE_MARGINS_IN.top + PAGE_MARGINS_IN.bottom) * 72 - PAGE_FIT_SAFETY_PT;
  return Math.max(1, Math.floor(usableHeightPt / tagHeightPt));
};

export const sheetFilename = (format, date = new Date()) =>
  `cenovnik-${PRICE_TAG_STYLES[format].fileSlug}-${date.toISOString().slice(0, 10)}.xlsx`;

// Browser only: draws on a canvas.
export const makeBarcodeDataUrl = (value) => {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, {
    format: "CODE128",
    displayValue: false,
    margin: 4,
    width: 2.5,
    height: 50,
  });
  return canvas.toDataURL("image/png");
};

// Rough Excel-width-unit -> pixel and point -> pixel conversions, good enough
// for sizing a placed image (doesn't need to be exact).
const colWidthToPx = (w) => Math.round(w * 7 + 5);
const ptToPx = (pt) => Math.round(pt * (96 / 72));
// exceljs's fractional `{ col: 1.05 }` image-anchor offset is computed with the
// wrong units internally (it ends up a few px at most, regardless of the
// fraction requested), so real centering needs the native EMU offset form
// instead — same EMU-per-pixel constant exceljs itself uses for image `ext`.
const EMU_PER_PX = 9525;

const thinBorder = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
};

export const buildWorkbook = (queue, format, { barcodeImage = makeBarcodeDataUrl } = {}) => {
  const style = PRICE_TAG_STYLES[format];
  const rowsPerItem = style.hasBarcode ? 3 : 2;
  const rowsPerPage = tagRowsPerPage(format);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cenovnici");
  sheet.columns = Array.from({ length: style.columns }, () => ({ width: style.columnWidth }));
  sheet.pageSetup = { paperSize: 9, orientation: "portrait", margins: PAGE_MARGINS_IN }; // 9 = A4

  queue.forEach((item, i) => {
    const col = (i % style.columns) + 1;
    const groupIndex = Math.floor(i / style.columns);
    if (col === 1 && groupIndex > 0 && groupIndex % rowsPerPage === 0) {
      // break after the previous tag row; (1, 16384) makes exceljs write max="16383",
      // the same full-width break Excel itself writes (its default would be 16838)
      sheet.getRow(groupIndex * rowsPerItem).addPageBreak(1, 16384);
    }
    const nameRow = sheet.getRow(groupIndex * rowsPerItem + 1);
    const priceRow = sheet.getRow(groupIndex * rowsPerItem + 2);
    nameRow.height = style.nameRowHeight;
    priceRow.height = style.priceRowHeight;

    const nameCell = nameRow.getCell(col);
    nameCell.value = item.name;
    nameCell.font = { name: "Bahnschrift SemiBold", bold: true, size: style.nameFontSize };
    nameCell.alignment = style.nameAlignment;
    nameCell.border = thinBorder;

    const priceText = formatPrice(item.price);
    const priceCell = priceRow.getCell(col);
    priceCell.value = priceText;
    priceCell.font = { name: "Oswald", bold: false, size: style.priceFontSize(priceText) };
    priceCell.alignment = style.priceAlignment;
    priceCell.border = thinBorder;

    if (style.hasBarcode) {
      const barcodeRow = sheet.getRow(groupIndex * rowsPerItem + 3);
      barcodeRow.height = style.barcodeRowHeight;
      // still draw the border on an (empty) cell so the tag outline stays closed
      barcodeRow.getCell(col).border = thinBorder;

      const imageId = workbook.addImage({
        base64: barcodeImage(item.barcode),
        extension: "png",
      });
      const rowIdx = groupIndex * rowsPerItem + 2; // 0-indexed row number of the barcode row
      const colIdx = col - 1; // 0-indexed
      const colPx = colWidthToPx(style.columnWidth);
      const rowPx = ptToPx(style.barcodeRowHeight);
      const imageWidthPx = colPx * FRUIT_BARCODE_WIDTH_FRACTION;
      const imageHeightPx = rowPx * 0.8;
      const horizontalMarginPx = (colPx - imageWidthPx) / 2; // centers the image in the column
      const verticalMarginPx = (rowPx - imageHeightPx) / 2;
      sheet.addImage(imageId, {
        tl: {
          nativeCol: colIdx,
          nativeColOff: Math.round(horizontalMarginPx * EMU_PER_PX),
          nativeRow: rowIdx,
          nativeRowOff: Math.round(verticalMarginPx * EMU_PER_PX),
        },
        ext: { width: imageWidthPx, height: imageHeightPx },
      });
    }
  });

  return workbook;
};

export const buildWorkbookBuffer = (queue, format, options) => buildWorkbook(queue, format, options).xlsx.writeBuffer();
