import { supabase } from "../supabaseClient.js";

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Posts to api/send-email.js, authenticated with the signed-in user's
// Supabase token. Throws "file-too-large" when the endpoint refuses the size
// (offer the download instead), "send-failed" otherwise.
const postEmail = async (body) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("no-session");

  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 413) throw new Error("file-too-large");
  if (!res.ok) throw new Error("send-failed");
};

// Sends a file to the shop's address. Without `subject` the mail is titled as
// a price-tag sheet.
export const sendFileByEmail = async (filename, blob, { subject } = {}) =>
  postEmail({ filename, base64: await blobToBase64(blob), ...(subject && { subject }) });

export const sendSheetByEmail = (filename, buffer) => sendFileByEmail(filename, new Blob([buffer], { type: XLSX }));

// Several price-tag sheets (Mix: shelf and fridge) as attachments of one mail.
export const sendSheetsByEmail = async (files, { subject } = {}) =>
  postEmail({
    files: await Promise.all(files.map(async ({ filename, buffer }) => ({ filename, base64: await blobToBase64(new Blob([buffer], { type: XLSX })) }))),
    ...(subject && { subject }),
  });
