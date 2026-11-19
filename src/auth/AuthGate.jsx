import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../supabaseClient";
import Login from "./Login.jsx";

// Renders `children(session)` once signed in, the login screen otherwise.
// A sign-in from the login screen opens the home page: after an expired
// session (days later) the last page — say a trebovanje — only confuses.
// A session that is still valid when the app opens keeps its page.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const navigate = useNavigate();
  const signedOut = useRef(false);

  useEffect(() => {
    const take = (next) => {
      if (!next) signedOut.current = true;
      else if (signedOut.current) {
        signedOut.current = false;
        navigate("/", { replace: true });
      }
      setSession(next);
    };
    supabase.auth.getSession().then(({ data }) => take(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => take(newSession));
    return () => sub.subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (session === undefined) {
    return <div className="flex min-h-dvh items-center justify-center text-[13px] text-ink-3">Učitavanje…</div>;
  }
  if (!session) return <Login />;
  return children(session);
}
