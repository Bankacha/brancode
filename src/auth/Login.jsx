import { useState } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { supabase } from "../supabaseClient";
import Button from "../components/Button.jsx";
import Field from "../components/Field.jsx";
import Logo from "../components/Logo.jsx";
import { greeting } from "../lib/greeting.js";

// Handoff "01 · Prijava".
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const ready = email.trim() !== "" && password !== "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setLoading(true);
    setFailed(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setFailed(true);
    setLoading(false);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pt-[calc(66px+env(safe-area-inset-top))] pb-[calc(40px+env(safe-area-inset-bottom))]">
      <Logo size={64} />
      <h1 className="mt-7 font-display text-[44px] leading-none font-extrabold tracking-[-0.03em] text-ink">
        <span className="block">{greeting()}</span>
        <span className="block">Prijavi se u radnju.</span>
      </h1>

      <form onSubmit={handleSubmit} className="mt-auto flex flex-col gap-3 pt-10">
        {failed && (
          <div className="flex items-center gap-2.5 rounded-error bg-danger-bg px-4 py-3 text-[15px] font-medium text-danger-ink">
            <CircleAlert size={18} className="shrink-0" />
            <span>Pogrešan email ili lozinka.</span>
          </div>
        )}
        <Field label="Email" type="email" autoComplete="email" placeholder="ime@radnja.rs" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Lozinka" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="dark" iconRight={ArrowRight} disabled={loading || !ready} className="mt-1 w-full">
          {loading ? "Prijavljivanje…" : "Prijavi se"}
        </Button>
      </form>
    </div>
  );
}
