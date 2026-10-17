---
paths:
  - "src/**/*.jsx"
---

# UI conventions

- All styling is inline style objects — no CSS files, CSS modules or framework. The `<style>` blocks only load the IBM Plex fonts and a few global resets.
- Colors and fonts are exported from `src/App.jsx` (`PAPER`, `INK`, `RED`, `GREEN`, `MUTE`, `BORDER`, `CARD`, `FONT_SANS`, `FONT_MONO`) and imported by `AuthGate` and `Login`. Use them instead of new hex values.
- Modals and menus use the `BottomSheet` component in `App.jsx` with the `sheet*Button` style objects. A sheet without `onClose` can't be dismissed by tapping the backdrop; that is used while work is in progress.
- Layout is phone-first: one column, `maxWidth: 480`.
- Errors show as a red banner (`AlertCircle`, `RED` on `#FBEAE8`). Success shows as a short green line that clears itself with `setTimeout`.
- Icons come from `lucide-react`.
