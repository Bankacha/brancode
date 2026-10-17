import React, { useState } from "react";
import { useNavigate } from "react-router";
import { FONT_MONO, MUTE, BORDER, CARD, INK, PAPER, outlineButton } from "../lib/legacyTheme.js";

export default function ManualEntry({ onSubmit }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const submit = () => {
    if (!code.trim()) return;
    onSubmit(code.trim());
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ fontSize: 13, color: MUTE }}>Broj barkoda</label>
      <input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="npr. 4104420000015"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 16,
          padding: "13px 14px",
          borderRadius: 10,
          border: `1px solid ${BORDER}`,
          background: CARD,
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={submit}
          disabled={!code.trim()}
          style={{
            flex: 1,
            background: code.trim() ? INK : BORDER,
            color: PAPER,
            border: "none",
            borderRadius: 10,
            padding: "13px",
            fontSize: 15,
            fontWeight: 600,
            cursor: code.trim() ? "pointer" : "not-allowed",
          }}
        >
          Nastavi
        </button>
        <button onClick={() => navigate("/")} style={outlineButton}>
          Otkaži
        </button>
      </div>
    </div>
  );
}
