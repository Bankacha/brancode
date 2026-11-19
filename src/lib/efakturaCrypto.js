import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Server only. The SEF API key is kept in the database sealed with
// AES-256-GCM under EFAKTURA_SECRET (base64 of 32 bytes, set on Vercel), so
// the database alone never reveals it. A fresh 12-byte IV per seal; the
// GCM tag makes any change to the stored values fail to open.

const secretBytes = (secretB64) => {
  const bytes = Buffer.from(typeof secretB64 === "string" ? secretB64 : "", "base64");
  if (bytes.length !== 32) throw new Error("bad-secret");
  return bytes;
};

export const encryptApiKey = (apiKey, secretB64) => {
  const key = secretBytes(secretB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
};

export const decryptApiKey = ({ ciphertext, iv, tag }, secretB64) => {
  const key = secretBytes(secretB64);
  // A full 16-byte tag only: Node would otherwise accept a shortened one.
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"), { authTagLength: 16 });
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
};

// What the app may show of a saved key.
export const keyLast4 = (apiKey) => apiKey.trim().slice(-4);
