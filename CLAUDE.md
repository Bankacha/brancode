# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Brancode (package name `shelf-price-scanner`) is a mobile-first PWA for a single shop: scan a product barcode, check/edit its price against a Supabase `products` table, collect items in a print list, and export that list as an `.xlsx` sheet of price tags (downloaded or emailed to the shop). It also imports monthly promo-leaflet PDFs and shows incoming invoices from SEF (e-Faktura) for bulk accepting and mailing. All user-facing text is Serbian (Latin script) — keep new UI strings, error messages and file names in Serbian; code comments are in English.

## Commands

```bash
npm install
npm run dev         # Vite dev server over HTTPS (self-signed cert via @vitejs/plugin-basic-ssl)
npm run dev:http    # same dev server over plain HTTP, for browsers that refuse the self-signed cert
npm run build       # production build into dist/
npm run preview     # serve the built dist/
npm test            # Vitest, single run (src/**/*.test.js[x], scripts/**/*.test.mjs; component tests opt into jsdom per file)
npm run test:watch  # Vitest in watch mode
npx vitest run src/lib/products.test.js   # a single test file
```

`npm test` and `npm run build` are the automated checks; there is no linter or type checker.

**Leftovers go to `docs/repovi.md`.** Every review finding that isn't fixed before a release, and everything waiting on the user (settings, decisions, checks in the shop), is written there in Serbian in the same PR — not only in the final report. Fixed items are removed from it.

HTTPS in dev is deliberate: camera access (`getUserMedia`) and `BarcodeDetector` require a secure context when opening the dev server from a phone on the LAN. `BarcodeDetector` exists only in Chromium-based browsers, so desktop Firefox/Safari fall back to manual entry.

`npm run dev` serves only `/api/efaktura`, always on the test SEF with an in-memory store (`scripts/efakturaDevApi.mjs`, see `.claude/rules/efaktura.md`). `api/send-email.js` and `api/promo-check.js` are Vercel serverless functions that run only on Vercel (or under `vercel dev`), so email sending and the leaflet morning check work only there; the morning check runs from Vercel Cron (`crons` in `vercel.json`). Deployment is automatic: pushes to the GitHub repo trigger a Vercel build.

## Versions and deploys

Merging to `main` is a production deploy (Vercel builds every push). The app's version is `version` in `package.json`, shown at the bottom of Podešavanja (`sheets/SettingsSheet.jsx` imports it). **Every merge to `main` bumps it in the same PR**: patch for fixes (0.9.0 → 0.9.1), minor for new features (0.9.x → 0.10.0), with `npm version <new> --no-git-tag-version` so `package-lock.json` follows. 1.0.0 is reserved for the day the shop starts relying on the app. `vercel.json` pins `framework: vite` / `outputDirectory: dist` — without it Vercel looks for `build/` and every deploy fails.

## Architecture

- **Routing:** `src/main.jsx` renders `BrowserRouter` → `AuthGate` → `App`. `AuthGate` (`src/auth/`) shows `Login` until a Supabase session exists (email/password; there is no sign-up flow — users are created in Supabase) and then renders `App` with the session (a sign-in from the login screen opens `/`, so an expired session doesn't land the user on the last page; a session still valid at launch keeps its page), which `App` passes down through `SessionProvider` (`auth/session.jsx`, read with `useSession()`). `App.jsx` holds the shared state, the `ToastProvider` and the routes: `/` (`screens/Home.jsx`), `/pregled` (`screens/PrintPreview.jsx`), `/skeniranje` (`screens/Scan.jsx`), `/rucni-unos` (`screens/ManualEntry.jsx`), and the list sections: `/popis` and `/trebovanje` (`screens/InventoryLists.jsx`, `RequisitionLists.jsx`), `/popis/:id` and `/trebovanje/:id` (`screens/ListDetail.jsx` with a config from `screens/listScreens.js`), and `…/:id/skeniranje` / `…/:id/rucni-unos` for each (`screens/ListScan.jsx`, `ListManualEntry.jsx`), `/e-faktura` (`screens/Efaktura.jsx`) and `/e-faktura/podesavanja` (`screens/EfakturaSettings.jsx`); unknown paths redirect to `/`. `vercel.json` serves `index.html` for every path except `/api/*`.
- **Menu:** each section screen starts with `components/AppHeader.jsx` (title, actions, menu button). Its `AppMenu` opens the menu sheet with the app's sections (the `SECTIONS` array; each feature adds its own entry: Cene, Popis, Trebovanje, e-Faktura), Podešavanja (`sheets/SettingsSheet.jsx`, which also leads to the e-Faktura settings) and Odjavi se. Picking a section replaces the menu's history entry, so back returns to the previous screen, not to the open menu.
- **Scanning and editing:** the camera and the keypad are shared pieces (`components/CameraScanner.jsx`, `BarcodeKeypad.jsx`) used by the price-tag screens and the list screens. `/skeniranje` scans in a row — a confirmed read pauses the camera and opens `sheets/EditSheet.jsx` over it; `/rucni-unos` does the same from a keypad; a long-press on a home list row opens the same sheet. `EditSheet` takes a `source` (`scan` / `manual` / `list`) that decides its content (quick price check vs. tag preview) and buttons.
- **Bottom sheets** (`src/sheets/`, built on `components/BottomSheet.jsx`) are not routes: the open sheet's name lives in the router's history state (`location.state.sheet`, via `lib/useSheet.js`), so system back closes it. A small window over a sheet ("Broj kopija") uses `useDialog`, which pushes its own history entry, so back closes only that window. Status messages go through `useToast()` (`components/Toast.jsx`).
- **No state library.** `App` keeps the print queue (`usePrintQueue`) and the product editor (`useProductEditor`) and passes them down; screens keep their own UI state.
- **`src/lib/`** holds the logic, with tests next to the pure parts:
  - `products.js` — barcode candidates, lookup and save against the `products` table
  - `priceTags.js` / `format.js` — tag formats, print geometry, page layout and the ExcelJS export; price formatting and parsing
  - `printQueue.js` — the per-device print list in `localStorage` (copies, leaflet promo, Mix choice); `tagFormats.js` — each article's remembered Mix format (`products.tag_format`)
  - `useProductEditor.js` — edit state for one scanned/typed barcode or list row (save, skip)
  - `scanner.js` — camera (high resolution, continuous focus, lens switch remembered as `camera-device`, torch) and the reader: built-in `BarcodeDetector` or zxing (`barcode-detector` ponyfill, wasm bundled and cached as `scanner`); a code counts after two matching frames. `useScannerReader.js` + "Čitač barkoda (test)" in Podešavanja are a temporary switch for comparing readers on the shop's phones — remove once one is chosen
  - `manualCode.js` — keypad input rules (digits only, up to 20)
  - `email.js` — sends a generated sheet through `api/send-email.js`
  - `printFormat.js` — the per-device chosen tag format; `download.js` — saves the Excel file
  - `useSheet.js` (also `useDialog`), `useLongPress.js`, `gestures.js`, `navigation.js` — sheet and dialog history, long-press, drag-to-close, leaving / finishing full-screen routes
  - `leafletStore.js` — data access for promo leaflets (`promo_leaflets`, `promo_leaflet_items`) and the prices they write, for any Supabase client; `leafletImport.js` — what an import remembers and writes; `promoCheck.js` — the morning check (promo prices on the first day, regular prices back after the last, reminder mails), run by `api/promo-check.js`; `leafletMarks.js` — the "Liflet" mark on a trebovanje
  - `plural.js` — Serbian count forms (1 cenovnik / 2 cenovnika / 5 cenovnika)
  - e-Faktura: `efaktura.js` — the client (calls `api/efaktura.js` only); `efakturaRules.js` — statuses, deadlines, day groups, the „Nije poslato“ rule, amounts, file names (shared). Server and dev only: `efakturaActions.js` (every action), `efakturaHandler.js` (session, env → context), `sefClient.js` (real SEF, 3 calls/s), `sefMock.js` (test SEF), `efakturaCrypto.js` (the sealed key), `efakturaStore.js` / `efakturaMemoryStore.js` (settings and history), `efakturaMail.js` (the mail), `efakturaPdf.js` (one PDF to print: merged with pdf-lib, without SEF's structured-format pages, read with pdf.js)
  - `listStore.js` + `inventories.js` / `requisitions.js` — shared list data access (Supabase) for Popis and Trebovanje (and `transferItems`); `listKinds.js` — what differs per list kind (store, rules, words); `useListItemFlow.js` — what happens after a code on a list; `listFormat.js` — list names, dates, quantities, the archive rule; `listPdf.js` — PDF exports (pdfmake, loaded on demand); `pdfOrder.js` — per-phone PDF row order (by name / as added); `ean.js` — check digit and "same article" codes; `useLoad.js` — load-on-open data for screens
- **Print preview:** `components/PriceTag.jsx` and `PrintPage.jsx` draw tags and A4 pages in real millimetres from the same geometry as the Excel export; `ScaledToWidth.jsx` scales them to the screen. The format choice is Raf | Friz | Voće | Mix; Mix (`components/MixList.jsx`) gives each tag Raf or Friz and exports one sheet per format.
- **e-Faktura** (`.claude/rules/efaktura.md`): incoming invoices are read live from SEF through `api/efaktura.js`; the sealed SEF key and the append-only history live in `efaktura_settings` / `efaktura_events`, which only the server reads.
- **Data split:** the Supabase `products` table is shared across devices; the print list lives only in each device's `localStorage`. Popis and Trebovanje lists (`inventories`, `requisitions` and their items; SQL in `supabase/migrations/`) are shared in Supabase and don't write to `products`, except a trebovanje's renamed article when the shop ticks to keep the name — see `.claude/rules/lists.md`.
- `src/promoLeaflet.js` holds leaflet PDF parsing (articles and the promotion period) and matching. Server code: `api/send-email.js`, `api/promo-check.js` and `api/efaktura.js` (both of the last import their logic from `src/lib/`).
- The "Pijaca" redesign: spec in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`, design handoff (tokens, measurements, copy) in `docs/design/redesign-handoff/`.

`src/templates/prices_template.xlsx`/`.xlsb` are not referenced by the code (the sheet is built from scratch).

## Rules

Topic-specific rules live in `.claude/rules/` and load when matching files are read:

- `products-and-barcodes.md` — Supabase data, print list storage, the EAN-13 check-digit quirk
- `price-tag-export.md` — tag formats and print-layout tuning in the ExcelJS export
- `promo-leaflet.md` — leaflet PDF parsing, what the import remembers and writes, the morning check
- `email-api.md` — the server functions (send-email, promo-check), their auth and env vars
- `ui-conventions.md` — inline styles, design tokens, shared UI pieces
- `pwa.md` — manifest and service worker
- `lists.md` — Popis and Trebovanje: shared lists in Supabase, duplicates, quantities, transfer, archive, PDF
- `efaktura.md` — e-Faktura: modes and switches, the sealed key, SEF limits, accepting, „Nije poslato“, mail, dev server
