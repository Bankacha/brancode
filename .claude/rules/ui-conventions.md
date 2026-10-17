---
paths:
  - "src/**/*.jsx"
---

# UI conventions

- New UI is styled only with Tailwind v4 classes built from the design tokens in `src/index.css` (`@theme`: `bg-bg`, `text-ink-2`, `bg-accent`, `rounded-field`, `shadow-toast`, `font-display`…). No hex values or inline styles in components, except values computed at runtime (e.g. tag dimensions in the print preview). Token values come from `docs/design/redesign-handoff/README.md`.
- Fonts (Bricolage Grotesque, DM Sans, DM Mono) are fontsource packages imported in `src/main.jsx`; they ship with the build and the service worker caches them, so don't load fonts from Google.
- Reuse the shared pieces instead of new variants: `components/Button.jsx` (accent/dark/outline/muted/text, lg/md), `Field.jsx`, `BottomSheet.jsx`, `Logo.jsx`, and `useToast()` for every status message. Open sheets only through `useSheet()` so system back closes them; switching sheet to sheet replaces the history entry.
- Any text with a count goes through `plural()` (`src/lib/plural.js`) — Serbian has three forms.
- Long-press uses `useLongPress` (500 ms, cancelled by movement/scroll); rows that can be long-pressed get `select-none` and `[-webkit-touch-callout:none]`.
- Screens not yet redesigned use inline style objects with the constants and button styles from `src/lib/legacyTheme.js` (`PAPER`, `INK`, `RED`, `GREEN`, `MUTE`, `BORDER`, `CARD`, `FONT_SANS`, `FONT_MONO`, `sheet*Button`…). That file is temporary — don't use it in new UI; it is deleted when the redesign replaces the last old screen.
- Layout is phone-first: one column, `maxWidth: 480`.
- Icons come from `lucide-react`.
