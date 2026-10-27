import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const MAX_BASE64_LENGTH = 4 * 1024 * 1024; // ~3MB decoded, safely under Vercel's 4.5MB body limit

// Price-tag sheets say to open them in Excel: mail previews leave the barcode
// images out. Popis and Trebovanje send their own subject and a PDF.
const mailText = (attachments, customSubject) => {
  const sheets = attachments.every((file) => file.filename.endsWith(".xlsx"));
  if (attachments.length > 1) {
    return sheets
      ? "U prilogu su generisani cenovnici. Otvorite priloge u Excel-u: pregled priloga u mejlu ne prikazuje barkodove."
      : `U prilogu su ${attachments.map((file) => file.filename).join(", ")}.`;
  }
  return customSubject
    ? `U prilogu je ${attachments[0].filename}.`
    : "U prilogu je generisan cenovnik. Otvorite prilog u Excel-u: pregled priloga u mejlu ne prikazuje barkodove.";
};

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

  // One file ({ filename, base64 }) or several ({ files: [...] }, Mix printing).
  const { filename, base64, files, subject } = req.body || {};
  const attachments = Array.isArray(files) ? files : [{ filename, base64 }];
  if (attachments.length === 0 || attachments.some((file) => !file?.filename || !file.base64 || typeof file.base64 !== "string")) {
    return res.status(400).json({ ok: false, error: "missing-file" });
  }
  if (attachments.reduce((total, file) => total + file.base64.length, 0) > MAX_BASE64_LENGTH) {
    return res.status(413).json({ ok: false, error: "file-too-large" });
  }

  // Popis and Trebovanje send their own subject; price-tag sheets don't.
  const customSubject = typeof subject === "string" ? subject.replace(/\s+/g, " ").trim().slice(0, 150) : "";

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Shelf Price Scanner <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      subject: customSubject || `Cenovnik – ${attachments[0].filename}`,
      text: mailText(attachments, customSubject),
      attachments: attachments.map((file) => ({ filename: file.filename, content: file.base64 })),
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
