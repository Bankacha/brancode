---
paths:
  - "src/**/*.jsx"
---

# UI conventions

- Screens not yet redesigned use inline style objects with the constants and button styles from `src/lib/legacyTheme.js` (`PAPER`, `INK`, `RED`, `GREEN`, `MUTE`, `BORDER`, `CARD`, `FONT_SANS`, `FONT_MONO`, `sheet*Button`…). That file is temporary — don't use it in new UI; it is deleted when the redesign replaces the last old screen.
- Old-style modals and menus use `src/sheets/BottomSheet.jsx`. A sheet without `onClose` can't be dismissed by tapping the backdrop; that is used while work is in progress.
- Layout is phone-first: one column, `maxWidth: 480`.
- Errors show as a red banner (`AlertCircle`, `RED` on `#FBEAE8`). Success shows as a short green line that clears itself with `setTimeout`.
- Icons come from `lucide-react`.
