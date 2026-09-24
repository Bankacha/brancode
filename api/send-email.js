import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const MAX_BASE64_LENGTH = 4 * 1024 * 1024; // ~3MB decoded, safely under Vercel's 4.5MB body limit

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method-not-allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, error: "missing-token" });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ ok: false, error: "invalid-token" });
  }

  const { filename, base64 } = req.body || {};
  if (!filename || !base64 || typeof base64 !== "string") {
    return res.status(400).json({ ok: false, error: "missing-file" });
  }
  if (base64.length > MAX_BASE64_LENGTH) {
    return res.status(413).json({ ok: false, error: "file-too-large" });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Shelf Price Scanner <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      subject: `Cenovnik – ${filename}`,
      text: "U prilogu je generisan cenovnik.",
      attachments: [{ filename, content: base64 }],
    });
    if (error) {
      console.error("resend error", error);
      return res.status(502).json({ ok: false, error: "send-failed" });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("send-email handler failed", e);
    return res.status(500).json({ ok: false, error: "server-error" });
  }
}
