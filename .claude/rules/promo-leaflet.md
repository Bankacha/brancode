---
paths:
  - "src/promoLeaflet.js"
  - "src/screens/Home.jsx"
---

# Promo leaflet import

- The PDF is parsed entirely in the browser with `pdfjs-dist`, imported dynamically (worker via `?url`) so it doesn't slow down startup. It is never uploaded or stored — keep it that way.
- `rowsFromTextItems` groups text items into lines by y-coordinate (`ROW_Y_TOLERANCE`), joins each line left to right, and matches `LEAFLET_ROW`: Šifra, EAN, Naziv, then the price. The price is the first decimal immediately followed by the Marža %, which keeps later columns and names like "2.8%T" out of it. Rows are de-duplicated by EAN across pages.
- Matching uses `barcodeCandidates()` and queries in batches of `LOOKUP_BATCH` so the request URL stays short.
- Only products already in the DB get the leaflet price. Leaflet articles not in the DB go onto the print list flagged `notInDb` and are **never** inserted into the DB.
- Importing replaces the print list, so the UI (`importStep` in `src/screens/Home.jsx`) asks before clearing a non-empty list. The hidden file input must be clicked synchronously in the click handler — browsers block file dialogs opened after an `await`.
- Errors meant for the user are thrown via `userFacingError` (`userFacing: true`); any other error shows a generic Serbian message.
