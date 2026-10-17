---
paths:
  - "vite.config.js"
  - "index.html"
  - "public/**"
---

# PWA

- `vite-plugin-pwa` generates the manifest and an auto-updating service worker (`registerType: "autoUpdate"`). `/api/*` is in `navigateFallbackDenylist` so email requests always reach the network — keep it there when changing the workbox config.
- The app name, theme color (`#1F1B16`) and background (`#FAF7F0`) are set in both `vite.config.js` (manifest) and `index.html`; keep them in sync. They match `INK` and `PAPER` in `src/App.jsx`.
- The icons in `public/` (`favicon-32`, `apple-touch-icon`, `icon-192`, `icon-512`) are generated from the Brancode logo.
