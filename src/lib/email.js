import { supabase } from "../supabaseClient.js";

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// Sends a file to the shop's address via api/send-email.js, authenticated
// with the signed-in user's Supabase token. Without `subject` the mail is
// titled as a price-tag sheet. Throws "file-too-large" when the endpoint
// refuses the size (offer the download instead), "send-failed" otherwise.
export const sendFileByEmail = async (filename, blob, { subject } = {}) => {
  const base64 = await blobToBase64(blob);

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
    body: JSON.stringify({ filename, base64, ...(subject && { subject }) }),
  });
  if (res.status === 413) throw new Error("file-too-large");
  if (!res.ok) throw new Error("send-failed");
};

export const sendSheetByEmail = (filename, buffer) =>
  sendFileByEmail(filename, new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
