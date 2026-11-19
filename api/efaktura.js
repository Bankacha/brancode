import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createEfakturaStore } from "../src/lib/efakturaStore.js";
import { contextFromEnv, handleEfaktura } from "../src/lib/efakturaHandler.js";

// e-Faktura (SEF): every action the app asks for (src/lib/efakturaActions.js),
// for a signed-in user (their Supabase token as `Authorization: Bearer …`).
// The SEF key lives sealed in efaktura_settings, read with the service-role
// key, which exists only here on the server. Env vars: see efakturaHandler.js.
const NEEDED = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "EMAIL_TO"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const missing = NEEDED.filter((name) => !process.env[name]);
  if (missing.length > 0 && req.method === "POST") {
    console.error("efaktura: missing env", missing);
    return res.status(500).json({ ok: false, error: "not-configured" });
  }

  const auth = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const verifyUser = async (token) => {
    const { data, error } = await auth().auth.getUser(token);
    return error || !data?.user ? null : { id: data.user.id, email: data.user.email };
  };
  const context = (user) => {
    const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const resend = new Resend(process.env.RESEND_API_KEY);
    const sendMail = async ({ to, subject, text, attachments }) => {
      const { error } = await resend.emails.send({
        from: "Shelf Price Scanner <onboarding@resend.dev>",
        to,
        subject,
        text,
        attachments: attachments.map((file) => ({ filename: file.filename, content: Buffer.from(file.content).toString("base64") })),
      });
      if (error) throw new Error("resend-failed");
    };
    return contextFromEnv(process.env, { store: createEfakturaStore(service), sendMail, user });
  };

  const result = await handleEfaktura({ method: req.method, authorization: req.headers.authorization, body: req.body }, { verifyUser, context });
  if (result.pdf) {
    res.setHeader("Content-Type", "application/pdf");
    return res.status(200).send(Buffer.from(result.pdf));
  }
  return res.status(result.status).json(result.json);
}
