---
paths:
  - "src/promoLeaflet.js"
  - "src/screens/Home.jsx"
  - "src/lib/leaflet*.js"
  - "src/lib/promoCheck.js"
  - "api/promo-check.js"
---

# Promo leaflet import

- The PDF is parsed entirely in the browser with `pdfjs-dist`, imported dynamically (worker via `?url`) so it doesn't slow down startup. It is never uploaded or stored — keep it that way.
- `rowsFromTextItems` groups text items into lines by y-coordinate (`ROW_Y_TOLERANCE`), joins each line left to right, and matches `LEAFLET_ROW`: Šifra, EAN, Naziv, then the price. The price is the first decimal immediately followed by the Marža %, which keeps later columns and names like "2.8%T" out of it. Rows are de-duplicated by EAN across pages.
- Matching uses `barcodeCandidates()` and queries in batches of `LOOKUP_BATCH` so the request URL stays short.
- **Period:** `leafletPeriodFromText` reads "<name> od d.m.yyyy do d.m.yyyy" from the first page's lines (`linesFromTextItems`); the real leaflet has exactly one such line ("Jutro Liflet Avg od 25.09.2026 do 31.10.2026"). The import sheet shows both dates in `DateField`s to correct; without both, with the end before the start, or with a promotion already over, it doesn't import. The name falls back to the file name.
- **What an import remembers** (`lib/leafletImport.js`, tables from `supabase/migrations/20261022_promo_leaflets.sql`): one `promo_leaflets` row per name + period (a re-import updates it), and per article already in the DB its promo price and the **regular price** to bring back — the DB price before the import, or the one remembered by this same leaflet (re-import) or by another running leaflet whose promo price the DB holds now. The promo prices go into `products` at once if the promotion has started; otherwise the morning check writes them on the first day.
- **The same leaflet with corrected dates:** before importing, `findSameLeaflet` looks for an open leaflet (prices not restored yet) whose period overlaps the new one and that has the same name (trimmed, case-insensitive) or at least `SAME_SHARE` (80%) of the new leaflet's DB articles (`sameArticleCodes`); an exact name + dates repeat is a plain re-import and doesn't ask. The import sheet asks "Da li je ovo isti liflet sa ispravljenim datumima?": "Da" passes `replaceId`, so `importLeaflet` moves that record to the new dates (`markLeaflet`, and clears `reminded_*_at` when the end changed) instead of saving a new one; "Ne" imports a new leaflet. That's why there is no delete button: a wrong record is deleted in Supabase. The shop imports the next leaflet up to 7 days before the running one ends, so two leaflets overlapping is normal.
- **Morning check** (`lib/promoCheck.js` via `api/promo-check.js`, Vercel Cron `0 5 * * *` = 6–7 h Belgrade in winter, 7–8 h in summer; "today" is the Belgrade date): 1) promo prices of a leaflet imported early, taking the regular price again; 2) the morning after the last day, regular prices back — only where the DB still holds that leaflet's promo price (rows found by `sameArticleCodes`, since a scan may have moved a 12-digit row to 13), otherwise `changed` and listed in a mail; an article on another running leaflet is `newer_leaflet` and hands its regular price on; 3) reminder mails "ističe sutra" / "ističe danas". Every step is stored (`prices_applied_at`, `restore_result`, `reminded_*_at`), so running it twice does nothing twice; a failed mail is logged and a reminder is tried again next run.
- The print list items from a leaflet carry `promo: { dateFrom, dateTo }`; the tag prints "Akcija važi do dd.mm.yyyy." and the editor keeps `promo` when the article is scanned again.
- Only products already in the DB get the leaflet price. Leaflet articles not in the DB go onto the print list flagged `notInDb` and are **never** inserted into the DB.
- Importing replaces the print list, so the UI (`confirmLeaflet` in `src/screens/Home.jsx`) asks before clearing a non-empty list. The hidden file input must be clicked synchronously in the click handler — browsers block file dialogs opened after an `await`.
- Errors meant for the user are thrown via `userFacingError` (`userFacing: true`); any other error shows a generic Serbian message.
