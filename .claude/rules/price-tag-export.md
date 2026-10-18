---
paths:
  - "src/lib/priceTags.js"
  - "src/lib/format.js"
---

# Price tag export (ExcelJS)

`buildWorkbook` / `buildWorkbookBuffer` in `src/lib/priceTags.js` build the sheet in the browser; the same buffer is used for download and for email. `tagRowsPerPage` and `formatPrice` (`src/lib/format.js`) are shared with anything that must match the print. Tests in `src/lib/priceTags.test.js` pin page breaks, fonts, columns, merges, rich-text prices and barcode images — keep them passing when tuning.

- **One source for paper and screen.** `tagGeometry`, `layoutTagPages`, `barcodeImageBox` and `sideBarcodeBox` in `src/lib/priceTags.js` drive both the Excel export (page breaks, barcode placement) and the on-screen preview (`components/PriceTag.jsx`, `PrintPage.jsx`, shown on `/pregled` and in the edit sheet). Change tag dimensions only through `PRICE_TAG_STYLES`; never size the preview separately.
- Column widths convert the way Excel lays them out: `px = trunc(((256·w + trunc(128/7)) / 256) · 7)` at 96 dpi (26.75 → 187 px = 49.48 mm; 40 → 280 px = 74.08 mm). Row heights are points (`pt · 25.4 / 72` mm). The fruit barcode image is positioned from the export's rougher `w·7+5` width on purpose, so the preview shows it where Excel actually puts it.
- The preview imitates Excel's text rendering: names wrap and clip in their cell, prices shrink to fit (`shrinkFontPt`, measured with `offsetWidth`: an inline span's `scrollWidth` is 0 and a bounding rect includes the preview's scale transform). On phones the name uses Barlow Semi Condensed in place of Bahnschrift. If printed paper and preview ever disagree, spec decision 4 applies: remove the A4 preview and the edit-sheet preview rather than tuning them apart from the export.
- **Shelf and fridge tags use two Excel columns each** (`columnWidths: [21.7, 5]` = 152 + 35 px, the same 187 px a single column had): the price column and a narrow column for the upright barcode, with the name cell merged across both. That way Excel's shrink-to-fit keeps the price out of the barcode. The outline goes around both cells with no line between them. Fruit tags keep one column (`columnWidths: [40]`).
- **Shelf/fridge prices are rich text:** the whole part at the format's size, the decimals (`,99`) as superscript at 0.75 of it, which Excel draws at roughly half size (`priceParts`). The preview draws them at `0.5em`, aligned to the top.
- **Upright barcode** (`barcode: "side"`): `makeSideBarcodeDataUrl` draws it with small digits, rotated to read bottom to top, at the proportions of `sideBarcodeBox`. `barcodeSymbology` picks EAN-13 for 12 digits (the POS export without its check digit; JsBarcode adds it) and valid 13-digit codes, EAN-8 for valid 8-digit codes, CODE128 otherwise, and nothing for an empty code. The fridge inset keeps it above the part the holder hides. The digits get at most a fifth of the thickness (`sideBarcodeLayout`) so the bars stay tall enough for a laser scanner held at an angle; at printed size both formats decode at 200 and 300 dpi.
- Formats are entries in `PRICE_TAG_STYLES` (`shelf`, `fridge`, `fruit`). The format is chosen on `/pregled` (`screens/PrintPreview.jsx`, remembered per device by `lib/printFormat.js`); a new format needs a new entry there and in that screen's segment control.
- Sizes are Excel column-width units and row heights in points, with mm constants for the physical tag holders (e.g. the fridge format pads top and bottom because the holder hides those edges). These numbers are print-layout tuning — don't "simplify" them without checking printed output.
- Manual page breaks keep each tag's rows on one A4 page (Excel paginates purely by height). The fit calculation relies on the explicit `PAGE_MARGINS_IN`, so change them together.
- The `fruit` format (`barcode: "row"`) embeds a horizontal CODE128 barcode image (JsBarcode on a canvas) in a third row. Images are positioned with native EMU offsets (`nativeColOff`/`nativeRowOff`) because ExcelJS computes fractional anchor offsets in the wrong units.
- The shelf/fridge barcodes are read by the shop's phones (this app's scanner), not by the POS till — tune them for phone cameras.
- The sheet hides Excel's on-screen grid (`views: [{ showGridLines: false }]`), so only tag outlines show; without it Excel draws a grey line between a price and its barcode column.
- Prices are formatted with the `sr-RS` locale (`1.249,99`); the shelf format picks its font size from the length of that text.
- Fonts `Bahnschrift SemiBold` and `Oswald` are referenced by name and must be installed on the machine that prints the sheet.
- File names follow `cenovnik-<fileSlug>-<YYYY-MM-DD>.xlsx`.
