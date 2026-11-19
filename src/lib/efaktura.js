import { supabase } from "../supabaseClient.js";

// The app's side of e-Faktura: every request goes to api/efaktura.js (never
// to SEF, which phones can't reach and which needs the key), signed in with
// the user's Supabase token. A refusal throws EfakturaError with the server's
// code; `body` keeps what it answered (e.g. the invoices already done).

export class EfakturaError extends Error {
  constructor(code, body = null) {
    super(code);
    this.name = "EfakturaError";
    this.code = code;
    this.body = body;
  }
}

const post = async (body) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new EfakturaError("no-session");
  let res;
  try {
    res = await fetch("/api/efaktura", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new EfakturaError("network");
  }
  if (!res.ok) {
    const answer = await res.json().catch(() => null);
    throw new EfakturaError(answer?.error ?? "server-error", answer);
  }
  return res;
};

export const efakturaCall = async (action, payload = {}) => (await post({ ...payload, action })).json();

export const efakturaPdf = async (invoiceId) => (await post({ action: "pdf", invoiceId })).blob();

const TEXTS = {
  network: "Nema veze. Proveri internet pa probaj ponovo.",
  "key-rejected": "SEF ne prihvata ovaj ključ. Proveri da li je status ključa Aktivan.",
  "sef-unavailable": "SEF trenutno ne odgovara. Pokušaj ponovo.",
  "not-configured": "e-Faktura nije podešena na serveru.",
  "accept-disabled": "Prihvatanje još nije uključeno",
  "send-failed": "Mejl nije poslat. Pokušaj ponovo.",
  "not-connected": "e-Faktura nije povezana.",
  "not-allowed": "Ovaj nalog nema pristup e-Fakturi.",
};

export const efakturaErrorText = (code) => TEXTS[code] ?? "Nešto nije u redu. Pokušaj ponovo.";
