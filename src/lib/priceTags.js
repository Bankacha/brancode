import ExcelJS from "exceljs";
import JsBarcode from "jsbarcode";
import { formatPrice } from "./format.js";
import { eanCheckDigitOk } from "./ean.js";
import { formatDate, todayIso } from "./listFormat.js";
import { expandCopies } from "./printQueue.js";

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

// Day first, by the shop's local date (UTC would say yesterday late at night).
export const sheetFilename = (format, date = new Date()) =>
  `cenovnik-${PRICE_TAG_STYLES[format].fileSlug}-${formatDate(todayIso(date))}.xlsx`;

// EAN symbols are shorter than CODE128 for the same digits, which matters on
// an upright barcode only ~25 mm long. 12, 7 and 11 digits are an EAN-13,
// EAN-8 and UPC-A the POS export stored without the check digit; JsBarcode
// adds it back.
export const barcodeSymbology = (code) => {
  const value = (code ?? "").trim();
  if (!value) return null;
  if (/^\d{12}$/.test(value)) return "EAN13";
  if (/^\d{7}$/.test(value)) return "EAN8"; // stored without its check digit; JsBarcode adds it
  if (/^\d{11}$/.test(value)) return "UPC";
  if (/^\d{13}$/.test(value) && eanCheckDigitOk(value)) return "EAN13";
  if (/^\d{8}$/.test(value) && eanCheckDigitOk(value)) return "EAN8";
  return "CODE128";
};

// How many digits the symbol prints: a code stored without its check digit
// (7, 11, 12) prints as EAN-8, UPC-A or EAN-13 with the digit added.
export const printedDigits = (code) => {
  const value = code.trim(); // as barcodeSymbology reads it
  const symbology = barcodeSymbology(value);
  const added = (symbology === "EAN8" && value.length === 7) || (symbology === "UPC" && value.length === 11) || (symbology === "EAN13" && value.length === 12);
  return value.length + (added ? 1 : 0);
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
// The digits are a courtesy; the bars' height is what lets a laser scanner
// sweep the barcode at an angle, so they get at most a fifth of it.
const SIDE_DIGITS_SHARE = 0.2;

// Sizes for an upright barcode `lengthPx` long (along the bars' run) in the
// proportions of `box`: digit size and bar height, in canvas px.
export const sideBarcodeLayout = (lengthPx, box, digits) => {
  const thickness = (lengthPx * box.widthMm) / box.heightMm;
  const fontSize = Math.min(thickness * SIDE_DIGITS_SHARE, (lengthPx * 0.9) / (digits * 0.6));
  return { fontSize, barHeight: Math.max(1, thickness - fontSize - SIDE_MODULE_PX) };
};

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
  const { fontSize, barHeight } = sideBarcodeLayout(draw(10, 10).width, box, printedDigits(value));
  const bars = draw(barHeight, fontSize);

  const upright = document.createElement("canvas");
  upright.width = bars.height;
  upright.height = bars.width;
  const ctx = upright.getContext("2d");
  ctx.translate(0, upright.height);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(bars, 0, 0);
  return upright.toDataURL("image/png");
};

// A leaflet article's tag says until when the promotion lasts. On shelf and
// fridge tags it sits in two lines in the empty space under the raised
// decimals (promoNoteBox); fruit prices have no raised decimals, so there it
// is one line at the top of the price cell (promoLineBox). Drawn as an image
// like the upright barcode, so rows, heights and tags per page stay as they
// are and Excel and the preview show the same.
export const promoLineText = (dateTo) => `Akcija važi do ${formatDate(dateTo)}.`;
export const promoNoteLines = (dateTo) => ["Akcija važi do", `${formatDate(dateTo)}.`];

export const promoLineBox = (format) => ({ leftMm: 0.6, topMm: 0.7, widthMm: tagGeometry(format).priceWidthMm - 1.2, heightMm: 2.2 });

const PROMO_LINE_PX_PER_MM = 12;
const PROMO_MAX_PT = 6; // the note is small print, never bigger than this
const PROMO_SPLIT_BELOW_PT = 3.6; // two lines smaller than this: try three
const PROMO_LINE_HEIGHT = 1.15;

// Browser only: draws `lines` centred in `box`, as big as they fit (up to
// PROMO_MAX_PT); two lines that would get too small go into three.
export const makePromoLineDataUrl = (lines, box) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(box.widthMm * PROMO_LINE_PX_PER_MM);
  canvas.height = Math.round(box.heightMm * PROMO_LINE_PX_PER_MM);
  const ctx = canvas.getContext("2d");
  const font = (px) => `600 ${px}px Arial, Helvetica, sans-serif`;
  const maxPx = PROMO_MAX_PT * PT_TO_MM * PROMO_LINE_PX_PER_MM;
  const fit = (rows) => {
    ctx.font = font(100);
    const widest = Math.max(...rows.map((row) => ctx.measureText(row).width));
    return Math.min((canvas.width / widest) * 100, canvas.height / (rows.length * PROMO_LINE_HEIGHT), maxPx);
  };
  let rows = lines;
  let size = fit(rows);
  if (rows.length === 2 && size < PROMO_SPLIT_BELOW_PT * PT_TO_MM * PROMO_LINE_PX_PER_MM) {
    const at = rows[0].indexOf(" ");
    const three = at > 0 ? [rows[0].slice(0, at), rows[0].slice(at + 1), rows[1]] : rows;
    const threeSize = fit(three);
    if (threeSize > size) [rows, size] = [three, threeSize];
  }
  ctx.font = font(size);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const step = size * PROMO_LINE_HEIGHT;
  const firstY = (canvas.height - step * rows.length) / 2 + step / 2;
  rows.forEach((row, i) => ctx.fillText(row, canvas.width / 2, firstY + i * step));
  return canvas.toDataURL("image/png");
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
const PT_TO_MM = 25.4 / 72;

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
// Copies are repeated first, so they fill pages like any other tag.
export const layoutTagPages = (queue, format) => {
  const { columns } = PRICE_TAG_STYLES[format];
  const rowsPerPage = tagRowsPerPage(format);
  const tags = expandCopies(queue);
  const rows = [];
  for (let i = 0; i < tags.length; i += columns) rows.push(tags.slice(i, i + columns));
  const pages = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) pages.push(rows.slice(i, i + rowsPerPage));
  return pages;
};

// Where the upright barcode sits inside its column of the price row.
// It runs from just under the name down to the bottom of the price digits,
// so a fridge holder never hides any of it (bars or digits).
export const sideBarcodeBox = (format, price, measure = measureOswaldMm) => {
  const style = PRICE_TAG_STYLES[format];
  if (style.barcode !== "side") return null;
  const { columnWidthsMm, priceHeightMm } = tagGeometry(format);
  const { top, bottom, side } = style.sideBarcodeInsetMm;
  const end = Math.min(priceLayout(price, format, measure).baselineMm, priceHeightMm - bottom);
  return { leftMm: side, topMm: top, widthMm: columnWidthsMm[1] - 2 * side, heightMm: end - top };
};

// --- One shelf/fridge price as Excel on Windows lays it out (Oswald) ---
// Where the digits and the raised decimals land in the price cell, for what
// goes around them: the promo note under the decimals, the barcode's end.
// Excel lays a line out with the font's winAscent/winDescent; the decimals
// (superscript at 0.75) come out at about half the price size, top-aligned.
const OSWALD = { ascent: 1.325, descent: 0.377, cap: 0.81 }; // em
const DECIMALS_DRAWN_SCALE = 0.5;

let measureContext; // undefined: not tried yet; null: no canvas here
const oswaldContext = () => {
  if (measureContext !== undefined) return measureContext;
  try {
    measureContext = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d") ?? null;
  } catch {
    measureContext = null;
  }
  return measureContext;
};

// Width of `text` in Oswald at `fontPt`, in mm; half an em a character where
// there is no canvas to measure on.
export const measureOswaldMm = (text, fontPt) => {
  const ctx = oswaldContext();
  if (!ctx) return text.length * 0.5 * fontPt * PT_TO_MM;
  ctx.font = `400 ${(fontPt * 96) / 72}px Oswald`;
  return pxToMm(ctx.measureText(text).width);
};

export const priceLayout = (price, format, measure = measureOswaldMm) => {
  const style = PRICE_TAG_STYLES[format];
  const { priceWidthMm, priceHeightMm } = tagGeometry(format);
  const { whole, decimals } = priceParts(price);
  const base = style.priceFontSize(formatPrice(price));
  const wholeAtBase = measure(whole, base);
  const decimalsAtBase = measure(decimals, base * DECIMALS_DRAWN_SCALE);
  const fontPt = shrinkFontPt(base, mmToPx(wholeAtBase + decimalsAtBase), mmToPx(priceWidthMm)); // Excel's shrink to fit
  const scale = fontPt / base;
  const wholeMm = wholeAtBase * scale;
  const decimalsMm = decimalsAtBase * scale;
  const em = fontPt * PT_TO_MM;
  const baselineMm =
    style.priceAlignment.vertical === "top" ? OSWALD.ascent * em : priceHeightMm / 2 + ((OSWALD.ascent - OSWALD.descent) / 2) * em;
  return { fontPt, baselineMm, capTopMm: baselineMm - OSWALD.cap * em, textLeftMm: (priceWidthMm - wholeMm - decimalsMm) / 2, wholeMm, decimalsMm };
};

const NOTE_GAP_MM = 0.5; // under the decimals
const NOTE_LEFT_SPARE_MM = 0.3; // off the last whole digit
const NOTE_RIGHT_MARGIN_MM = 0.6; // off the barcode column
const NOTE_WIDTH_MM = 12; // room it may take to the right of narrow decimals

// The space under the raised decimals: from just right of the whole digits,
// as wide as the decimals (or up to NOTE_WIDTH_MM where there is room to the
// right), down to the bottom of the digits. Fruit: the line at the top.
export const promoNoteBox = (price, format, measure = measureOswaldMm) => {
  if (PRICE_TAG_STYLES[format].barcode !== "side") return promoLineBox(format);
  const { priceWidthMm } = tagGeometry(format);
  const layout = priceLayout(price, format, measure);
  const left = layout.textLeftMm + layout.wholeMm + NOTE_LEFT_SPARE_MM;
  const right = Math.min(priceWidthMm - NOTE_RIGHT_MARGIN_MM, left + Math.max(layout.decimalsMm - NOTE_LEFT_SPARE_MM, NOTE_WIDTH_MM));
  const top = layout.capTopMm + OSWALD.cap * DECIMALS_DRAWN_SCALE * layout.fontPt * PT_TO_MM + NOTE_GAP_MM;
  return { leftMm: left, topMm: top, widthMm: Math.max(0, right - left), heightMm: layout.baselineMm - top };
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

export const buildWorkbook = (
  queue,
  format,
  { barcodeImage = makeBarcodeDataUrl, sideBarcodeImage = makeSideBarcodeDataUrl, promoLineImage = makePromoLineDataUrl } = {}
) => {
  const style = PRICE_TAG_STYLES[format];
  const rowsPerItem = style.barcode === "row" ? 3 : 2;

  const workbook = new ExcelJS.Workbook();
  // Excel draws its grey grid on screen wherever a cell has no border of its
  // own — e.g. between a shelf price and its barcode column. Only the tag
  // outlines should show (the grid never prints anyway).
  const sheet = workbook.addWorksheet("Cenovnici", { views: [{ showGridLines: false }] });
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
        addTag(workbook, sheet, format, item, groupIndex, col, rowsPerItem, { barcodeImage, sideBarcodeImage, promoLineImage });
      });
      groupIndex++;
    });
  });

  return workbook;
};

const addTag = (workbook, sheet, format, item, groupIndex, col, rowsPerItem, { barcodeImage, sideBarcodeImage, promoLineImage }) => {
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
  if (item.promo?.dateTo) addPromoLine(workbook, sheet, format, item, nameRowNumber, col, promoLineImage);

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
  const box = sideBarcodeBox(format, item.price);
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

const addPromoLine = (workbook, sheet, format, item, nameRowNumber, col, promoLineImage) => {
  const under = PRICE_TAG_STYLES[format].barcode === "side";
  const box = under ? promoNoteBox(item.price, format) : promoLineBox(format);
  const lines = under ? promoNoteLines(item.promo.dateTo) : [promoLineText(item.promo.dateTo)];
  let image = null;
  try {
    image = promoLineImage(lines, box);
  } catch {
    // no canvas to draw on; the tag still prints, without the line
  }
  if (!image) return;
  const imageId = workbook.addImage({ base64: image, extension: "png" });
  sheet.addImage(imageId, {
    tl: {
      nativeCol: col - 1, // 0-indexed: the price column
      nativeColOff: Math.round(mmToPx(box.leftMm) * EMU_PER_PX),
      nativeRow: nameRowNumber, // 0-indexed: the price row
      nativeRowOff: Math.round(mmToPx(box.topMm) * EMU_PER_PX),
    },
    ext: { width: mmToPx(box.widthMm), height: mmToPx(box.heightMm) },
  });
};

// Oswald must be loaded before prices are measured for the promo note and the
// barcode's end (the preview loads it too; the export may run first).
const loadPriceFont = async () => {
  try {
    await globalThis.document?.fonts?.load?.('400 40px "Oswald"');
  } catch {
    // measured with the fallback font; the layout stays close
  }
};

export const buildWorkbookBuffer = async (queue, format, options) => {
  await loadPriceFont();
  return buildWorkbook(queue, format, options).xlsx.writeBuffer();
};
