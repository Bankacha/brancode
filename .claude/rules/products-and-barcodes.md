---
paths:
  - "src/**/*.js"
  - "src/**/*.jsx"
---

# Products data and barcodes

- The Supabase `products` table (`barcode`, `name`, `price`) is shared across all devices. It was imported once from the shop's POS (kasa) export and has since been kept up to date by scanning: saving an unknown product inserts it. The browser client in `src/supabaseClient.js` uses the publishable key, which is hardcoded on purpose. RLS requires an authenticated user for writes.
- The print list is **per device**: `localStorage` key `print-queue`, items `{ id, barcode, name, price, notInDb? }`. It is never written to Supabase.
- **EAN check-digit quirk:** about half of the product rows store EAN-13 barcodes without the trailing check digit (12 digits), because the POS export drops it. A camera scan reads all 13 digits, so an exact match misses. Every lookup must go through `barcodeCandidates()` in `src/lib/products.js`, which tries the exact 13-digit code first, then its 12-digit prefix. `lookupProduct` and `saveProduct` in the same module are the only place the scan/edit flow talks to the `products` table.
- This is handled in code, not by a one-time migration, because a fresh import from the POS would bring the 12-digit codes back.
- When a product found via the 12-digit fallback is saved, `saveProduct` moves that row to the full scanned code (`update` where `barcode` = `matchedBarcode`) instead of inserting a second row, so scanned products gradually end up under their full code. If the update touches no row, it falls back to `upsert`. The leaflet import writes to the matched row's barcode without moving it.
- The POS export itself contains about 170 pairs where both a 13-digit code and its 12-digit prefix exist. Usually the 12-digit row is an older card (short name, old price); sometimes it is a different product entirely. Exact match first picks the 13-digit row, which is the right one — don't merge or delete these pairs automatically.
- If a product that exists shows up as "novi artikal", compare the scanned code with what is stored before assuming an app bug.
