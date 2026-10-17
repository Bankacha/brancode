---
paths:
  - "src/**/*.jsx"
---

# UI conventions

- New UI is styled only with Tailwind v4 classes built from the design tokens in `src/index.css` (`@theme`: `bg-bg`, `text-ink-2`, `bg-accent`, `rounded-field`, `shadow-toast`, `font-display`…). No hex values or inline styles in components, except values computed at runtime (e.g. tag dimensions in the print preview). Token values come from `docs/design/redesign-handoff/README.md`.
- Fonts (Bricolage Grotesque, DM Sans, DM Mono) are fontsource packages imported in `src/main.jsx`; they ship with the build and the service worker caches them, so don't load fonts from Google.
- Screens not yet redesigned use inline style objects with the constants and button styles from `src/lib/legacyTheme.js` (`PAPER`, `INK`, `RED`, `GREEN`, `MUTE`, `BORDER`, `CARD`, `FONT_SANS`, `FONT_MONO`, `sheet*Button`…). That file is temporary — don't use it in new UI; it is deleted when the redesign replaces the last old screen.
- Old-style modals and menus use `src/sheets/BottomSheet.jsx`. A sheet without `onClose` can't be dismissed by tapping the backdrop; that is used while work is in progress.
- Layout is phone-first: one column, `maxWidth: 480`.
- Errors show as a red banner (`AlertCircle`, `RED` on `#FBEAE8`). Success shows as a short green line that clears itself with `setTimeout`.
- Icons come from `lucide-react`.
