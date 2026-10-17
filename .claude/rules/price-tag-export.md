---
paths:
  - "src/lib/priceTags.js"
  - "src/lib/format.js"
---

# Price tag export (ExcelJS)

`buildWorkbook` / `buildWorkbookBuffer` in `src/lib/priceTags.js` build the sheet in the browser; the same buffer is used for download and for email. `tagRowsPerPage` and `formatPrice` (`src/lib/format.js`) are shared with anything that must match the print. Tests in `src/lib/priceTags.test.js` pin page breaks, fonts and fruit images — keep them passing when tuning.

- **One source for paper and screen.** `tagGeometry`, `layoutTagPages` and `barcodeImageBox` in `src/lib/priceTags.js` drive both the Excel export (page breaks, barcode placement) and the on-screen preview (`components/PriceTag.jsx`, `PrintPage.jsx`, shown on `/pregled` and in the edit sheet). Change tag dimensions only through `PRICE_TAG_STYLES`; never size the preview separately.
- Column widths convert the way Excel lays them out: `px = trunc(((256·w + trunc(128/7)) / 256) · 7)` at 96 dpi (26.75 → 187 px = 49.48 mm; 40 → 280 px = 74.08 mm). Row heights are points (`pt · 25.4 / 72` mm). The fruit barcode image is positioned from the export's rougher `w·7+5` width on purpose, so the preview shows it where Excel actually puts it.
- The preview imitates Excel's text rendering: names wrap and clip in their cell, prices shrink to fit (`shrinkFontPt`). On phones the name uses Barlow Semi Condensed in place of Bahnschrift. If printed paper and preview ever disagree, spec decision 4 applies: remove the A4 preview and the edit-sheet preview rather than tuning them apart from the export.
- Formats are entries in `PRICE_TAG_STYLES` (`shelf`, `fridge`, `fruit`). The format is chosen on `/pregled` (`screens/PrintPreview.jsx`, remembered per device by `lib/printFormat.js`); a new format needs a new entry there and in that screen's segment control.
- Sizes are Excel column-width units and row heights in points, with mm constants for the physical tag holders (e.g. the fridge format pads top and bottom because the holder hides those edges). These numbers are print-layout tuning — don't "simplify" them without checking printed output.
- Manual page breaks keep each tag's rows on one A4 page (Excel paginates purely by height). The fit calculation relies on the explicit `PAGE_MARGINS_IN`, so change them together.
- The `fruit` format embeds a CODE128 barcode image (JsBarcode on a canvas). Images are positioned with native EMU offsets (`nativeColOff`/`nativeRowOff`) because ExcelJS computes fractional anchor offsets in the wrong units.
- Prices are formatted with the `sr-RS` locale (`1.249,99`); the shelf format picks its font size from the length of that text.
- Fonts `Bahnschrift SemiBold` and `Oswald` are referenced by name and must be installed on the machine that prints the sheet.
- File names follow `cenovnik-<fileSlug>-<YYYY-MM-DD>.xlsx`.
