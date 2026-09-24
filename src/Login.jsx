import React, { useState } from "react";
import { AlertCircle, LogIn } from "lucide-react";
import { supabase } from "./supabaseClient";
import { FONT_SANS, FONT_MONO, PAPER, INK, RED, MUTE, BORDER, CARD } from "./App";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setLoginError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setLoginError("Pogrešan email ili lozinka.");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        fontFamily: FONT_SANS,
        background: PAPER,
        color: INK,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        input:focus { outline: 2px solid ${INK}; outline-offset: 1px; }
      `}</style>
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 340,
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
          Shelf Price Scanner
        </h1>
        <p style={{ fontSize: 13, color: MUTE, margin: "0 0 20px" }}>Prijavi se da nastaviš.</p>

        {loginError && (
          <div
            style={{
              display: "flex",
              gap: 8,
              fontSize: 13,
              color: RED,
              background: "#FBEAE8",
              padding: 10,
              borderRadius: 8,
              marginBottom: 14,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{loginError}</span>
          </div>
        )}

        <label style={{ fontSize: 12, color: MUTE }}>Email</label>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ime@radnja.rs"
          style={{
            width: "100%",
            fontSize: 15,
            padding: "11px 12px",
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            margin: "4px 0 14px",
          }}
        />

        <label style={{ fontSize: 12, color: MUTE }}>Lozinka</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{
            fontFamily: FONT_MONO,
            width: "100%",
            fontSize: 15,
            padding: "11px 12px",
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            margin: "4px 0 18px",
          }}
        />

        <button
          type="submit"
          disabled={loading || !email.trim() || !password}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: loading || !email.trim() || !password ? BORDER : INK,
            color: PAPER,
            border: "none",
            borderRadius: 10,
            padding: "13px",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading || !email.trim() || !password ? "not-allowed" : "pointer",
          }}
        >
          <LogIn size={17} /> {loading ? "Prijavljivanje…" : "Prijavi se"}
        </button>
      </form>
    </div>
  );
}
