---
paths:
  - "src/**/*.jsx"
---

# UI conventions

- New UI is styled only with Tailwind v4 classes built from the design tokens in `src/index.css` (`@theme`: `bg-bg`, `text-ink-2`, `bg-accent`, `rounded-field`, `shadow-toast`, `font-display`…). No hex values or inline styles in components, except values computed at runtime (e.g. tag dimensions in the print preview). Token values come from `docs/design/redesign-handoff/README.md`.
- Fonts are fontsource packages: the UI fonts (Bricolage Grotesque, DM Sans, DM Mono) are imported in `src/main.jsx`, the print fonts (Oswald, Barlow Semi Condensed) in `components/PriceTag.jsx`. They ship with the build and the service worker caches them, so don't load fonts from Google.
- Reuse the shared pieces instead of new variants: `components/Button.jsx` (accent/dark/outline/muted/text, lg/md), `IconButton.jsx` (round header button), `Field.jsx`, `BottomSheet.jsx`, `Logo.jsx`, and `useToast()` for every status message. Open sheets only through `useSheet()` so system back closes them; switching sheet to sheet replaces the history entry.
- Any text with a count goes through `plural()` (`src/lib/plural.js`) — Serbian has three forms.
- Long-press uses `useLongPress` (500 ms, cancelled by movement/scroll); rows that can be long-pressed get `select-none` and `[-webkit-touch-callout:none]`.
- Layout is phone-first: one column, `maxWidth: 480`.
- Icons come from `lucide-react`.
- Every section screen (Cene, Popis, Trebovanje) starts with `AppHeader` so the menu button sits in the same place everywhere. A new section adds itself to `SECTIONS` in `components/AppMenu.jsx`.
- Sheets stay above the on-screen keyboard: `index.html` asks Android to shrink the page (`interactive-widget=resizes-content`) and `BottomSheet` follows `useVisibleViewport` (iPhone), capping its height to what is visible; a sheet that still doesn't fit scrolls by touch. Fields that save get `enterKeyHint="done"` and save on Enter (or sit in a `<form>` with a submit button).
