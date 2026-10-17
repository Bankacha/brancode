import React from "react";
import { FONT_SANS, FONT_MONO, PAPER, INK, MUTE } from "../lib/legacyTheme.js";

// The pre-redesign page frame for screens not yet redesigned (temporary,
// removed with legacyTheme.js at the end of phase 4).
export default function LegacyLayout({ queueLength, children }) {
  return (
    <div style={{ fontFamily: FONT_SANS, background: PAPER, color: INK, minHeight: "100dvh", padding: "20px 16px 40px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        input:focus { outline: 2px solid ${INK}; outline-offset: 1px; }
      `}</style>
      <header style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Brancode</h1>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTE }}>{queueLength} u listi</span>
        </div>
        <p style={{ fontSize: 13, color: MUTE, margin: "4px 0 0" }}>Skeniraj artikal, proveri cenu i dodaj ga u listu za štampu.</p>
      </header>
      {children}
    </div>
  );
}
