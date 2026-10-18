---
paths:
  - "src/lib/listStore.js"
  - "src/lib/inventories.js"
  - "src/lib/useInventoryItemFlow.js"
  - "src/lib/listFormat.js"
  - "src/lib/listPdf.js"
  - "src/screens/Inventory*.jsx"
  - "src/screens/useInventoryEntry.js"
  - "src/sheets/Inventory*.jsx"
  - "supabase/migrations/*.sql"
---

# Lists: Popis (and Trebovanje)

Spec: `docs/superpowers/specs/2026-10-18-brancode-popis-trebovanje-design.md`. Tables come from `supabase/migrations/20261018_popis_trebovanje.sql`, which the user runs by hand in the Supabase SQL editor; a schema change means a new migration file and asking the user to run it.

- **Shared, in Supabase.** Every signed-in phone sees and edits the same lists (RLS: authenticated users, all rows). Data access goes only through `createListStore` (`lib/listStore.js`) with a per-type config (`lib/inventories.js`); every method throws on a failed request and screens show "Nema veze…" with "Ponovi".
- **Never write to `products`.** Lists only read it (`lookupArticle`, which also finds the 13-digit row for 12 typed digits). An article found there has its name and price locked on the popis; articles not in `products` get them typed and stay only on the list.
- **Same article = same code**, a full EAN-13 and its 12-digit prefix, or 12 digits and the code with its check digit added (`sameArticleCodes` in `lib/ean.js`). Duplicates are checked in the database before adding (`findItem`), and an insert refused by the unique `(list, barcode)` index is treated as "already on the list" — another phone was faster. The stored barcode is the scanned/typed one, or the full 13-digit code when 12 digits were typed for a 13-digit `products` row.
- **Quantities add up in the database** (`add_inventory_quantity` RPC, `quantity = quantity + n`), never by writing back a value read earlier. Popis quantities are ≥ 0 with up to 3 decimals (`parseQuantity(…, { allowZero: true })`).
- **No live updates.** Screens load on open (`useLoad`) and reload after every change; the PDF export reloads first.
- **Item flow** (`useInventoryItemFlow`) is one state machine shown in one sheet named `item`: loading → new | duplicate → add | edit. Back closes the sheet and cancels the flow. The camera and keypad screens share `useInventoryEntry` and use the popis as their `home` for `leaveScreen` / `putHomeBehind`.
- **PDF** (`lib/listPdf.js`): document definitions are plain data and tested; pdfmake and its Roboto font (č ć š ž đ) are imported only when exporting. A4 portrait, table header repeated on every page (`headerRows: 1`), "Strana X od Y" footer, file `popis-<from>_<to>.pdf`.
