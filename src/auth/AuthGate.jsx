import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Login from "./Login.jsx";

// Renders `children(session)` once signed in, the login screen otherwise.
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
    return <div className="flex min-h-dvh items-center justify-center text-[13px] text-ink-3">Učitavanje…</div>;
  }
  if (!session) return <Login />;
  return children(session);
}
