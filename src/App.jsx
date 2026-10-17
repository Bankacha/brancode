import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { usePrintQueue } from "./lib/printQueue.js";
import { useProductEditor } from "./lib/useProductEditor.js";
import { FONT_SANS, FONT_MONO, PAPER, INK, MUTE } from "./lib/legacyTheme.js";
import Home from "./screens/Home.jsx";
import Scan from "./screens/Scan.jsx";
import ManualEntry from "./screens/ManualEntry.jsx";

export default function App() {
  const navigate = useNavigate();
  const [queue, setQueue] = usePrintQueue();
  const editor = useProductEditor(queue, setQueue);

  // Replace the camera / manual-entry entry so system back doesn't return to it.
  const openCode = (code) => {
    navigate("/", { replace: true });
    editor.open(code);
  };

  return (
    <div
      style={{
        fontFamily: FONT_SANS,
        background: PAPER,
        color: INK,
        minHeight: "100%",
        padding: "20px 16px 40px",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        input:focus { outline: 2px solid ${INK}; outline-offset: 1px; }
      `}</style>

      <header style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Brancode</h1>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTE }}>{queue.length} u listi</span>
        </div>
        <p style={{ fontSize: 13, color: MUTE, margin: "4px 0 0" }}>Skeniraj artikal, proveri cenu i dodaj ga u listu za štampu.</p>
      </header>

      <Routes>
        <Route path="/" element={<Home queue={queue} setQueue={setQueue} editor={editor} />} />
        <Route path="/skeniranje" element={<Scan onDetected={openCode} />} />
        <Route path="/rucni-unos" element={<ManualEntry onSubmit={openCode} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
