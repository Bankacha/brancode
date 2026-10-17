# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Brancode (package name `shelf-price-scanner`) is a mobile-first PWA for a single shop: scan a product barcode, check/edit its price against a Supabase `products` table, collect items in a print list, and export that list as an `.xlsx` sheet of price tags (downloaded or emailed to the shop). It also imports monthly promo-leaflet PDFs. All user-facing text is Serbian (Latin script) — keep new UI strings, error messages and file names in Serbian; code comments are in English.

## Commands

```bash
npm install
npm run dev      # Vite dev server over HTTPS (self-signed cert via @vitejs/plugin-basic-ssl)
npm run build    # production build into dist/
npm run preview  # serve the built dist/
```

There is no test runner, linter or type checker configured; `npm run build` is the only automated check.

HTTPS in dev is deliberate: camera access (`getUserMedia`) and `BarcodeDetector` require a secure context when opening the dev server from a phone on the LAN. `BarcodeDetector` exists only in Chromium-based browsers, so desktop Firefox/Safari fall back to manual entry.

`npm run dev` does **not** serve `api/send-email.js` — that is a Vercel serverless function. Email sending only works on Vercel (or under `vercel dev`). Deployment is automatic: pushes to the GitHub repo trigger a Vercel build.

## Architecture

- **No router, no state library.** `src/main.jsx` renders `AuthGate` → `App`. `AuthGate` shows `Login` until a Supabase session exists (email/password; there is no sign-up flow — users are created in Supabase).
- **`src/App.jsx` is the whole app** (`PriceScanner` component): a `mode` state machine (`idle | scanning | editing | manualEntry`), plus separate state for the leaflet import flow (`importStep`) and bottom-sheet menus. It also builds the Excel export.
- **Data split:** the Supabase `products` table is shared across devices; the print list lives only in each device's `localStorage`.
- `src/promoLeaflet.js` holds leaflet PDF parsing and the shared barcode-matching helper. `api/send-email.js` is the only server code.

`src/templates/prices_template.xlsx`/`.xlsb` are not referenced by the code (the sheet is built from scratch).

## Rules

Topic-specific rules live in `.claude/rules/` and load when matching files are read:

- `products-and-barcodes.md` — Supabase data, print list storage, the EAN-13 check-digit quirk
- `price-tag-export.md` — tag formats and print-layout tuning in the ExcelJS export
- `promo-leaflet.md` — leaflet PDF parsing and what the import may write to the DB
- `email-api.md` — the send-email function, its auth and env vars
- `ui-conventions.md` — inline styles, design tokens, shared UI pieces
- `pwa.md` — manifest and service worker
