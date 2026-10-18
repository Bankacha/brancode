import { supabase } from "../supabaseClient.js";

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// Sends the generated sheet to the shop's address via api/send-email.js,
// authenticated with the signed-in user's Supabase token.
export const sendSheetByEmail = async (filename, buffer) => {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
    body: JSON.stringify({ filename, base64 }),
  });
  if (!res.ok) throw new Error("send-failed");
};
