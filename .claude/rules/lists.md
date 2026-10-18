---
paths:
  - "src/lib/listStore.js"
  - "src/lib/inventories.js"
  - "src/lib/requisitions.js"
  - "src/lib/listKinds.js"
  - "src/lib/useListItemFlow.js"
  - "src/lib/listFormat.js"
  - "src/lib/listPdf.js"
  - "src/screens/Inventory*.jsx"
  - "src/screens/Requisition*.jsx"
  - "src/screens/List*.jsx"
  - "src/screens/listScreens.js"
  - "src/screens/useListEntry.js"
  - "src/sheets/*List*.jsx"
  - "src/sheets/Inventory*.jsx"
  - "src/sheets/Requisition*.jsx"
  - "src/sheets/TransferSheet.jsx"
  - "supabase/migrations/*.sql"
---

# Lists: Popis and Trebovanje

Spec: `docs/superpowers/specs/2026-10-18-brancode-popis-trebovanje-design.md`. Tables come from `supabase/migrations/20261018_popis_trebovanje.sql`, which the user runs by hand in the Supabase SQL editor; a schema change means a new migration file and asking the user to run it.

- **Shared, in Supabase.** Every signed-in phone sees and edits the same lists (RLS: authenticated users, all rows). Data access goes only through `createListStore` (`lib/listStore.js`) with a per-type config (`lib/inventories.js`, `lib/requisitions.js`); what else differs per kind (rules, words, section) is in `lib/listKinds.js`, and what the list screen shows in `screens/listScreens.js`; every method throws on a failed request and screens show "Nema veze…" with "Ponovi".
- **Never write to `products`.** Lists only read it (`lookupArticle`, which also finds the 13-digit row for 12 typed digits). An article found there has its price locked, and its name too on a popis (`rules.lockProductName`; on a trebovanje the name may be changed); articles not in `products` get them typed and stay only on the list.
- **Same article = same code**, a full EAN-13 and its 12-digit prefix, or 12 digits and the code with its check digit added (`sameArticleCodes` in `lib/ean.js`). Duplicates are checked in the database before adding (`findItem`), and an insert refused by the unique `(list, barcode)` index is treated as "already on the list" — another phone was faster. The stored barcode is the scanned/typed one, or the full 13-digit code when 12 digits were typed for a 13-digit `products` row. Known gap: the unique index is on the raw string, so two phones adding the 12- and the 13-digit form of the same article at the same instant can still get two rows (the `findItem` check isn't atomic with the insert); a normalised column in the index would close it.
- **Quantities add up in the database** (`add_inventory_quantity` RPC, `quantity = quantity + n`), never by writing back a value read earlier. Popis items need name, price and a quantity ≥ 0; Trebovanje items need only a name — barcode, price (> 0) and quantity (> 0) are optional and stored as null, and "Dodaj količinu" on an item without one sets it (`add_requisition_quantity` uses `coalesce`). Quantities take up to 3 decimals.
- **A list deleted on another phone:** `addItem` answers `{ listGone }` (foreign-key error 23503) and the entry screens go to the section's list with a message; a missing item on update/add-quantity is `gone`.
- **No live updates.** Screens load on open (`useLoad`) and reload after every change; the PDF export reloads first.
- **Item flow** (`useListItemFlow`) is one state machine shown in one sheet named `item` (`ListItemSheet`): loading → new | duplicate → add | edit; a stale lookup is dropped (request counter). Back closes the sheet and cancels the flow. The camera and keypad screens share `useListEntry` and use the list as their `home` for `leaveScreen` / `putHomeBehind`. Trebovanje's keypad has "Bez barkoda" for an item that is just a name.
- **Trebovanje archive:** dated more than 20 days ago → under "Arhiva" (`isArchived`); nothing is deleted automatically.
- **Prenesi stavke** (`transferItems`) copies chosen items into another or a new trebovanje and opens it. An article already on the target (same barcode, or the same name for items without one) gets the quantity added or is skipped. Picking items is the `select` history entry, so back leaves it.
- **PDF** (`lib/listPdf.js`): document definitions are plain data and tested; pdfmake and its Roboto font (č ć š ž đ) are imported only when exporting. A4 portrait, table header repeated on every page (`headerRows: 1`), "Strana X od Y" footer; rows sorted per list kind as chosen in Podešavanja (`lib/pdfOrder.js`: by name with Serbian Latin collation, or in the order added; stored per phone as `pdf-order`, read at export time); files `popis-<dd.mm.yyyy>-<dd.mm.yyyy>.pdf` and `trebovanje-<dd.mm.yyyy>.pdf` (with an empty box per row to tick after printing).
- **Dates** are ISO strings in data and day first everywhere the shop sees them (`formatDate`); date inputs use `components/DateField.jsx`, which shows dd.mm.yyyy over the browser's own date format.
