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

// Shelf and fridge tags carry an upright barcode beside the price, in a narrow
// column of its own (the name spans both), so Excel's shrink-to-fit keeps the
// price out of it. 21.7 + 5 lay out as 152 + 35 px — the same 187 px as the
// single 26.75 column before.
const SIDE_BARCODE_COLUMNS = [21.7, 5];
const SIDE_BARCODE_INSET_MM = { top: 0.8, bottom: 0.8, side: 0.6 };
// Excel draws superscript smaller than its stated size; 0.75 of the price
// size comes out at about half. The preview draws the decimals at half.
const DECIMALS_SUPERSCRIPT_SCALE = 0.75;

export const PRICE_TAG_STYLES = {
  shelf: {
    label: "Cene za rafove",
    fileSlug: "raf",
    columns: 3,
    columnWidths: SIDE_BARCODE_COLUMNS,
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
    barcode: "side",
    sideBarcodeInsetMm: SIDE_BARCODE_INSET_MM,
  },
  fridge: {
    label: "Cene za frižider",
    fileSlug: "frizider",
    columns: 3,
    columnWidths: SIDE_BARCODE_COLUMNS,
    nameRowHeight: 28.5 + (FRIDGE_TOP_BUFFER_MM + FRIDGE_EXTRA_TOP_MM) * MM_TO_PT,
    priceRowHeight: 77.25 + FRIDGE_BOTTOM_BUFFER_MM * MM_TO_PT - FRIDGE_EXTRA_TOP_MM * MM_TO_PT,
    nameFontSize: 12,
    nameAlignment: { horizontal: "center", vertical: "bottom", wrapText: true },
    priceAlignment: { horizontal: "center", vertical: "top", shrinkToFit: true },
    priceFontSize: () => FRIDGE_PRICE_FONT_SIZE,
    barcode: "side",
    // the barcode must stay in the band the holder leaves visible
    sideBarcodeInsetMm: { ...SIDE_BARCODE_INSET_MM, bottom: FRIDGE_BOTTOM_BUFFER_MM + SIDE_BARCODE_INSET_MM.bottom },
  },
  fruit: {
    label: "Cene za voće",
    fileSlug: "voce",
    columns: 2,
    columnWidths: [40],
    nameRowHeight: FRUIT_NAME_HEIGHT_MM * MM_TO_PT,
    priceRowHeight: FRUIT_PRICE_HEIGHT_MM * MM_TO_PT,
    barcodeRowHeight: FRUIT_BARCODE_HEIGHT_MM * MM_TO_PT,
    nameFontSize: FRUIT_NAME_FONT_SIZE,
    nameAlignment: { horizontal: "center", vertical: "middle", wrapText: true },
    priceAlignment: { horizontal: "center", vertical: "middle", shrinkToFit: true },
    priceFontSize: FRUIT_PRICE_FONT_SIZE,
    barcode: "row", // a horizontal barcode in a third row below the price
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

// EAN-13 / EAN-8 check digit: weights 3,1,3,… from the right of the data digits.
const eanCheckDigitOk = (digits) => {
  const data = digits.slice(0, -1).split("").map(Number).reverse();
  const sum = data.reduce((total, d, i) => total + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
};

// EAN symbols are shorter than CODE128 for the same digits, which matters on
// an upright barcode only ~25 mm long. 12 digits are an EAN-13 the POS export
// stored without its check digit; JsBarcode adds it back.
export const barcodeSymbology = (code) => {
  const value = (code ?? "").trim();
  if (!value) return null;
  if (/^\d{12}$/.test(value)) return "EAN13";
  if (/^\d{13}$/.test(value) && eanCheckDigitOk(value)) return "EAN13";
  if (/^\d{8}$/.test(value) && eanCheckDigitOk(value)) return "EAN8";
  return "CODE128";
};

// "1.249,99" → whole "1.249", decimals ",99" (printed smaller and raised).
export const priceParts = (price) => {
  const text = formatPrice(price);
  const comma = text.lastIndexOf(",");
  return { whole: text.slice(0, comma), decimals: text.slice(comma) };
};

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

// Browser only. The upright barcode beside a shelf/fridge price, with small
// digits along it, drawn at the proportions of `box` so the digits aren't
// stretched. Reads bottom to top. Null when there is nothing to draw.
const SIDE_MODULE_PX = 4; // drawn large, scaled down by the image size
const SIDE_QUIET_MODULES = 7;
export const makeSideBarcodeDataUrl = (code, box) => {
  const format = barcodeSymbology(code);
  if (!format) return null;
  const value = code.trim();
  const draw = (height, fontSize) => {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format,
      flat: true,
      width: SIDE_MODULE_PX,
      height,
      margin: 0,
      marginLeft: SIDE_QUIET_MODULES * SIDE_MODULE_PX,
      marginRight: SIDE_QUIET_MODULES * SIDE_MODULE_PX,
      displayValue: true,
      fontSize,
      textMargin: SIDE_MODULE_PX,
    });
    return canvas;
  };
  // First pass for the barcode's length, then the bar height that gives the
  // box's proportions once the digits are added.
  const length = draw(10, 10).width;
  const thickness = (length * box.widthMm) / box.heightMm;
  const fontSize = Math.min(thickness * 0.3, (length * 0.9) / (value.length * 0.6));
  const bars = draw(Math.max(1, thickness - fontSize - SIDE_MODULE_PX), fontSize);

  const upright = document.createElement("canvas");
  upright.width = bars.height;
  upright.height = bars.width;
  const ctx = upright.getContext("2d");
  ctx.translate(0, upright.height);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(bars, 0, 0);
  return upright.toDataURL("image/png");
};

// --- Print geometry, shared by the Excel export and the on-screen preview ---

// Excel's column-width → pixel rule at 96 dpi; 7 px is the max digit width of
// the workbook's default font (Calibri 11). A stored width of 9.140625 gives
// Excel's familiar 64 px default column.
const MAX_DIGIT_WIDTH_PX = 7;
const columnWidthPx = (width) =>
  Math.trunc(((256 * width + Math.trunc(128 / MAX_DIGIT_WIDTH_PX)) / 256) * MAX_DIGIT_WIDTH_PX);
const pxToMm = (px) => (px * 25.4) / 96;
export const columnWidthMm = (width) => pxToMm(columnWidthPx(width));
export const ptToMm = (pt) => (pt * 25.4) / 72;

export const tagGeometry = (format) => {
  const style = PRICE_TAG_STYLES[format];
  const nameHeightMm = ptToMm(style.nameRowHeight);
  const priceHeightMm = ptToMm(style.priceRowHeight);
  const barcodeHeightMm = style.barcode === "row" ? ptToMm(style.barcodeRowHeight) : 0;
  const columnWidthsMm = style.columnWidths.map(columnWidthMm);
  return {
    columns: style.columns,
    columnWidthsMm, // per tag: the price column, then the barcode column if any
    widthMm: columnWidthsMm.reduce((sum, w) => sum + w, 0),
    priceWidthMm: columnWidthsMm[0],
    nameHeightMm,
    priceHeightMm,
    barcodeHeightMm,
    heightMm: nameHeightMm + priceHeightMm + barcodeHeightMm,
  };
};

// Pages → rows → items, breaking pages exactly where the export does.
export const layoutTagPages = (queue, format) => {
  const { columns } = PRICE_TAG_STYLES[format];
  const rowsPerPage = tagRowsPerPage(format);
  const rows = [];
  for (let i = 0; i < queue.length; i += columns) rows.push(queue.slice(i, i + columns));
  const pages = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) pages.push(rows.slice(i, i + rowsPerPage));
  return pages;
};

// Where the upright barcode sits inside its column of the price row.
export const sideBarcodeBox = (format) => {
  const style = PRICE_TAG_STYLES[format];
  if (style.barcode !== "side") return null;
  const { columnWidthsMm, priceHeightMm } = tagGeometry(format);
  const { top, bottom, side } = style.sideBarcodeInsetMm;
  return { leftMm: side, topMm: top, widthMm: columnWidthsMm[1] - 2 * side, heightMm: priceHeightMm - top - bottom };
};

// Where the export places the fruit barcode image inside its cell, in px.
// It sizes from a rough width (w·7+5, not the exact column width), so the
// image sits a little right of centre on paper — the preview copies that.
const barcodeImagePx = (style) => {
  const colPx = Math.round(style.columnWidths[0] * 7 + 5);
  const rowPx = Math.round(style.barcodeRowHeight * (96 / 72));
  const width = colPx * FRUIT_BARCODE_WIDTH_FRACTION;
  const height = rowPx * 0.8;
  return { left: (colPx - width) / 2, top: (rowPx - height) / 2, width, height };
};

export const barcodeImageBox = (format) => {
  const style = PRICE_TAG_STYLES[format];
  if (style.barcode !== "row") return null;
  const { left, top, width, height } = barcodeImagePx(style);
  return { leftMm: pxToMm(left), topMm: pxToMm(top), widthMm: pxToMm(width), heightMm: pxToMm(height) };
};

// Excel's "shrink to fit": text wider than the cell (minus ~2 px padding per
// side) is scaled down to fit.
const CELL_PADDING_PX = 4;
export const shrinkFontPt = (fontPt, textWidthPx, cellWidthPx) => {
  const available = cellWidthPx - CELL_PADDING_PX;
  return textWidthPx <= available ? fontPt : (fontPt * available) / textWidthPx;
};

// exceljs's fractional `{ col: 1.05 }` image-anchor offset is computed with the
// wrong units internally (it ends up a few px at most, regardless of the
// fraction requested), so real centering needs the native EMU offset form
// instead — same EMU-per-pixel constant exceljs itself uses for image `ext`.
const EMU_PER_PX = 9525;

const thin = { style: "thin" };
const thinBorder = { top: thin, bottom: thin, left: thin, right: thin };
const mmToPx = (mm) => (mm * 96) / 25.4;

export const buildWorkbook = (queue, format, { barcodeImage = makeBarcodeDataUrl, sideBarcodeImage = makeSideBarcodeDataUrl } = {}) => {
  const style = PRICE_TAG_STYLES[format];
  const rowsPerItem = style.barcode === "row" ? 3 : 2;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cenovnici");
  sheet.columns = Array.from({ length: style.columns }).flatMap(() => style.columnWidths.map((width) => ({ width })));
  sheet.pageSetup = { paperSize: 9, orientation: "portrait", margins: PAGE_MARGINS_IN }; // 9 = A4

  let groupIndex = 0;
  layoutTagPages(queue, format).forEach((page, pageIndex) => {
    page.forEach((row, rowIndex) => {
      if (pageIndex > 0 && rowIndex === 0) {
        // Excel paginates purely by height, so a tag could otherwise split
        // across sheets. Break after the previous tag row; (1, 16384) makes
        // exceljs write max="16383", the same full-width break Excel itself
        // writes (its default would be 16838).
        sheet.getRow(groupIndex * rowsPerItem).addPageBreak(1, 16384);
      }
      row.forEach((item, tagIndex) => {
        const col = tagIndex * style.columnWidths.length + 1;
        addTag(workbook, sheet, format, item, groupIndex, col, rowsPerItem, { barcodeImage, sideBarcodeImage });
      });
      groupIndex++;
    });
  });

  return workbook;
};

const addTag = (workbook, sheet, format, item, groupIndex, col, rowsPerItem, { barcodeImage, sideBarcodeImage }) => {
  const style = PRICE_TAG_STYLES[format];
  const side = style.barcode === "side";
  const nameRowNumber = groupIndex * rowsPerItem + 1;
  const nameRow = sheet.getRow(nameRowNumber);
  const priceRow = sheet.getRow(nameRowNumber + 1);
  nameRow.height = style.nameRowHeight;
  priceRow.height = style.priceRowHeight;

  const nameCell = nameRow.getCell(col);
  if (side) {
    nameRow.getCell(col + 1).border = thinBorder;
    sheet.mergeCells(nameRowNumber, col, nameRowNumber, col + 1);
  }
  nameCell.value = item.name;
  nameCell.font = { name: "Bahnschrift SemiBold", bold: true, size: style.nameFontSize };
  nameCell.alignment = style.nameAlignment;
  nameCell.border = thinBorder;

  const priceText = formatPrice(item.price);
  const priceSize = style.priceFontSize(priceText);
  const priceCell = priceRow.getCell(col);
  priceCell.font = { name: "Oswald", bold: false, size: priceSize };
  priceCell.alignment = style.priceAlignment;
  if (side) {
    const { whole, decimals } = priceParts(item.price);
    priceCell.value = {
      richText: [
        { text: whole, font: { name: "Oswald", size: priceSize } },
        { text: decimals, font: { name: "Oswald", size: Math.round(priceSize * DECIMALS_SUPERSCRIPT_SCALE), vertAlign: "superscript" } },
      ],
    };
    // one outline around price and barcode, no line between them
    priceCell.border = { top: thin, bottom: thin, left: thin };
    priceRow.getCell(col + 1).border = { top: thin, bottom: thin, right: thin };
    addSideBarcode(workbook, sheet, format, item, nameRowNumber, col, sideBarcodeImage);
  } else {
    priceCell.value = priceText;
    priceCell.border = thinBorder;
  }

  if (style.barcode === "row") {
    const barcodeRow = sheet.getRow(groupIndex * rowsPerItem + 3);
    barcodeRow.height = style.barcodeRowHeight;
    // still draw the border on an (empty) cell so the tag outline stays closed
    barcodeRow.getCell(col).border = thinBorder;

    const imageId = workbook.addImage({ base64: barcodeImage(item.barcode), extension: "png" });
    const { left, top, width, height } = barcodeImagePx(style);
    sheet.addImage(imageId, {
      tl: {
        nativeCol: col - 1, // 0-indexed
        nativeColOff: Math.round(left * EMU_PER_PX),
        nativeRow: groupIndex * rowsPerItem + 2, // 0-indexed row number of the barcode row
        nativeRowOff: Math.round(top * EMU_PER_PX),
      },
      ext: { width, height },
    });
  }
};

const addSideBarcode = (workbook, sheet, format, item, nameRowNumber, col, sideBarcodeImage) => {
  if (!barcodeSymbology(item.barcode)) return;
  const box = sideBarcodeBox(format);
  let image = null;
  try {
    image = sideBarcodeImage(item.barcode, box);
  } catch {
    // a code JsBarcode can't draw; the tag still prints, without a barcode
  }
  if (!image) return;
  const imageId = workbook.addImage({ base64: image, extension: "png" });
  sheet.addImage(imageId, {
    tl: {
      nativeCol: col, // 0-indexed: the column after the price
      nativeColOff: Math.round(mmToPx(box.leftMm) * EMU_PER_PX),
      nativeRow: nameRowNumber, // 0-indexed: the price row
      nativeRowOff: Math.round(mmToPx(box.topMm) * EMU_PER_PX),
    },
    ext: { width: mmToPx(box.widthMm), height: mmToPx(box.heightMm) },
  });
};

export const buildWorkbookBuffer = (queue, format, options) => buildWorkbook(queue, format, options).xlsx.writeBuffer();
