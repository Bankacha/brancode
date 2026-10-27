import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createLeafletStore } from "../src/lib/leafletStore.js";
import { belgradeToday, runPromoCheck } from "../src/lib/promoCheck.js";

// The morning check for promo leaflets (src/lib/promoCheck.js), started by
// Vercel Cron (vercel.json). Vercel sends `Authorization: Bearer <CRON_SECRET>`;
// without that secret configured nothing runs. The database is reached with
// the service-role key, which exists only here on the server.
const NEEDED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "EMAIL_TO"];

// Compared in constant time, so the answer's timing says nothing about the secret.
const sameSecret = (given, expected) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("promo-check: CRON_SECRET is not set");
    return res.status(500).json({ ok: false, error: "not-configured" });
  }
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method-not-allowed" });
  }
  if (!sameSecret(req.headers.authorization || "", `Bearer ${secret}`)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  const missing = NEEDED.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error("promo-check: missing env", missing);
    return res.status(500).json({ ok: false, error: "not-configured" });
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const resend = new Resend(process.env.RESEND_API_KEY);
    const sendMail = async ({ subject, text }) => {
      const { error } = await resend.emails.send({ from: "Shelf Price Scanner <onboarding@resend.dev>", to: process.env.EMAIL_TO, subject, text });
      if (error) throw error;
    };
    const result = await runPromoCheck({ store: createLeafletStore(supabase), sendMail, today: belgradeToday() });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("promo-check failed", e);
    return res.status(500).json({ ok: false, error: "server-error" });
  }
}
