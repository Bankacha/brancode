import React, { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import { FONT_SANS, FONT_MONO, PAPER, INK, MUTE, BORDER } from "./App";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div
        style={{
          fontFamily: FONT_SANS,
          background: PAPER,
          color: MUTE,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
        }}
      >
        Učitavanje…
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 480,
          margin: "0 auto",
          padding: "10px 16px 0",
          fontFamily: FONT_SANS,
        }}
      >
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: MUTE }}>{session.user.email}</span>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            color: INK,
            cursor: "pointer",
          }}
        >
          <LogOut size={13} /> Odjava
        </button>
      </div>
      {children}
    </div>
  );
}
