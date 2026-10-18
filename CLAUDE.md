# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Brancode (package name `shelf-price-scanner`) is a mobile-first PWA for a single shop: scan a product barcode, check/edit its price against a Supabase `products` table, collect items in a print list, and export that list as an `.xlsx` sheet of price tags (downloaded or emailed to the shop). It also imports monthly promo-leaflet PDFs. All user-facing text is Serbian (Latin script) — keep new UI strings, error messages and file names in Serbian; code comments are in English.

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

HTTPS in dev is deliberate: camera access (`getUserMedia`) and `BarcodeDetector` require a secure context when opening the dev server from a phone on the LAN. `BarcodeDetector` exists only in Chromium-based browsers, so desktop Firefox/Safari fall back to manual entry.

`npm run dev` does **not** serve `api/send-email.js` — that is a Vercel serverless function. Email sending only works on Vercel (or under `vercel dev`). Deployment is automatic: pushes to the GitHub repo trigger a Vercel build.

## Architecture

- **Routing:** `src/main.jsx` renders `BrowserRouter` → `AuthGate` → `App`. `AuthGate` (`src/auth/`) shows `Login` until a Supabase session exists (email/password; there is no sign-up flow — users are created in Supabase) and then renders `App` with the session, which `App` passes down through `SessionProvider` (`auth/session.jsx`, read with `useSession()`). `App.jsx` holds the shared state, the `ToastProvider` and the routes: `/` (`screens/Home.jsx`), `/pregled` (`screens/PrintPreview.jsx`), `/skeniranje` (`screens/Scan.jsx`), `/rucni-unos` (`screens/ManualEntry.jsx`); unknown paths redirect to `/`. `vercel.json` serves `index.html` for every path except `/api/*`.
- **Menu:** each section screen starts with `components/AppHeader.jsx` (title, actions, menu button). Its `AppMenu` opens the menu sheet with the app's sections (the `SECTIONS` array; each feature adds its own entry), Podešavanja (`sheets/SettingsSheet.jsx`) and Odjavi se. Picking a section replaces the menu's history entry, so back returns to the previous screen, not to the open menu.
- **Scanning and editing:** `/skeniranje` scans in a row — a confirmed read pauses the camera and opens `sheets/EditSheet.jsx` over it; `/rucni-unos` does the same from a keypad; a long-press on a home list row opens the same sheet. `EditSheet` takes a `source` (`scan` / `manual` / `list`) that decides its content (quick price check vs. tag preview) and buttons.
- **Bottom sheets** (`src/sheets/`, built on `components/BottomSheet.jsx`) are not routes: the open sheet's name lives in the router's history state (`location.state.sheet`, via `lib/useSheet.js`), so system back closes it. Status messages go through `useToast()` (`components/Toast.jsx`).
- **No state library.** `App` keeps the print queue (`usePrintQueue`) and the product editor (`useProductEditor`) and passes them down; screens keep their own UI state.
- **`src/lib/`** holds the logic, with tests next to the pure parts:
  - `products.js` — barcode candidates, lookup and save against the `products` table
  - `priceTags.js` / `format.js` — tag formats, print geometry, page layout and the ExcelJS export; price formatting and parsing
  - `printQueue.js` — the per-device print list in `localStorage`
  - `useProductEditor.js` — edit state for one scanned/typed barcode or list row (save, skip)
  - `scanner.js` — camera (high resolution, continuous focus, lens switch remembered as `camera-device`, torch) and the reader: built-in `BarcodeDetector` or zxing (`barcode-detector` ponyfill, wasm bundled and cached as `scanner`); a code counts after two matching frames. `useScannerReader.js` + "Čitač barkoda (test)" in Podešavanja are a temporary switch for comparing readers on the shop's phones — remove once one is chosen
  - `manualCode.js` — keypad input rules (digits only, up to 20)
  - `email.js` — sends a generated sheet through `api/send-email.js`
  - `printFormat.js` — the per-device chosen tag format; `download.js` — saves the Excel file
  - `useSheet.js`, `useLongPress.js`, `gestures.js`, `navigation.js` — sheet history, long-press, drag-to-close, leaving / finishing full-screen routes
  - `plural.js` — Serbian count forms (1 cenovnik / 2 cenovnika / 5 cenovnika)
- **Print preview:** `components/PriceTag.jsx` and `PrintPage.jsx` draw tags and A4 pages in real millimetres from the same geometry as the Excel export; `ScaledToWidth.jsx` scales them to the screen.
- **Data split:** the Supabase `products` table is shared across devices; the print list lives only in each device's `localStorage`.
- `src/promoLeaflet.js` holds leaflet PDF parsing and matching. `api/send-email.js` is the only server code.
- The "Pijaca" redesign: spec in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`, design handoff (tokens, measurements, copy) in `docs/design/redesign-handoff/`.

`src/templates/prices_template.xlsx`/`.xlsb` are not referenced by the code (the sheet is built from scratch).

## Rules

Topic-specific rules live in `.claude/rules/` and load when matching files are read:

- `products-and-barcodes.md` — Supabase data, print list storage, the EAN-13 check-digit quirk
- `price-tag-export.md` — tag formats and print-layout tuning in the ExcelJS export
- `promo-leaflet.md` — leaflet PDF parsing and what the import may write to the DB
- `email-api.md` — the send-email function, its auth and env vars
- `ui-conventions.md` — inline styles, design tokens, shared UI pieces
- `pwa.md` — manifest and service worker
