import React from "react";
import { BORDER, CARD } from "../lib/legacyTheme.js";

// Without onClose (e.g. while work is in flight) tapping the backdrop does nothing.
export default function BottomSheet({ onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(31,27,22,0.4)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: CARD,
          borderRadius: "16px 16px 0 0",
          padding: "10px 16px 24px",
        }}
      >
        <div style={{ width: 36, height: 4, background: BORDER, borderRadius: 2, margin: "4px auto 16px" }} />
        {children}
      </div>
    </div>
  );
}
