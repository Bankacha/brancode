// Pre-redesign look, kept only until phases 2–4 replace these screens with
// Tailwind ones. Do not use in new UI; delete at the end of phase 4.
export const FONT_SANS = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const FONT_MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const PAPER = "#FAF7F0";
export const INK = "#1F1B16";
export const RED = "#C1443C";
export const GREEN = "#5B7A6A";
export const MUTE = "#8A8073";
export const BORDER = "#DED7C6";
export const CARD = "#FFFFFF";

export const secondaryHalfButton = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "transparent",
  color: INK,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: "13px 12px",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};

export const sheetOptionButton = {
  width: "100%",
  background: "transparent",
  color: INK,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: "14px",
  fontSize: 15,
  fontWeight: 500,
  cursor: "pointer",
  marginBottom: 8,
};

export const sheetPrimaryButton = {
  ...sheetOptionButton,
  background: INK,
  color: PAPER,
  border: "none",
  fontWeight: 600,
};

export const sheetCancelButton = {
  width: "100%",
  background: "none",
  border: "none",
  color: MUTE,
  fontSize: 14,
  padding: "10px",
  cursor: "pointer",
};

export const sheetMessage = { fontSize: 14, color: INK, margin: "0 0 16px", textAlign: "center", lineHeight: 1.5 };

export const errorBanner = { display: "flex", gap: 8, fontSize: 13, color: RED, background: "#FBEAE8", padding: 10, borderRadius: 8 };

export const outlineButton = { background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "13px 16px", fontSize: 14, cursor: "pointer" };
