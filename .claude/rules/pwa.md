---
paths:
  - "vite.config.js"
  - "index.html"
  - "public/**"
  - "scripts/build-icons.mjs"
---

# PWA

- `vite-plugin-pwa` generates the manifest and an auto-updating service worker (`registerType: "autoUpdate"`). `/api/*` is in `navigateFallbackDenylist` so email requests always reach the network — keep it there when changing the workbox config. Fonts are cached at runtime (`fonts` cache) so the app keeps its typeface offline.
- The app name, theme color and background (`#FBF6EE`, the design's `bg` token) are set in both `vite.config.js` (manifest) and `index.html`; keep them in sync. `index.html` uses `viewport-fit=cover` so safe-area padding works.
- Icons are generated, never edited by hand: `npm run icons` (`scripts/build-icons.mjs`) outlines the letter of the handoff logo (`docs/design/redesign-handoff/assets/logo-nisan.svg`) with the real Bricolage font and writes `src/assets/logo.svg` plus `public/favicon-32.png`, `icon-192.png`, `icon-512.png` (rounded tile) and `apple-touch-icon.png`, `icon-maskable-512.png` (square tile — iOS rounds it, Android masks it).
