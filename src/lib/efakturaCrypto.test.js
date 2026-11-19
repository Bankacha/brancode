import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptApiKey, encryptApiKey, keyLast4 } from "./efakturaCrypto.js";

const SECRET = randomBytes(32).toString("base64");
const KEY = "a1b2c3d4-e5f6-7890-abcd-ef0123456789";

// Flips one bit of a base64 value, keeping its length.
const flip = (b64) => {
  const bytes = Buffer.from(b64, "base64");
  bytes[0] ^= 1;
  return bytes.toString("base64");
};

describe("efakturaCrypto", () => {
  it("round-trips a key", () => {
    expect(decryptApiKey(encryptApiKey(KEY, SECRET), SECRET)).toBe(KEY);
  });

  it("uses a fresh iv every time", () => {
    const a = encryptApiKey(KEY, SECRET);
    const b = encryptApiKey(KEY, SECRET);
    expect(Buffer.from(a.iv, "base64")).toHaveLength(12);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("never stores the key in the clear", () => {
    const sealed = encryptApiKey(KEY, SECRET);
    expect(JSON.stringify(sealed)).not.toContain(KEY);
    expect(Buffer.from(sealed.ciphertext, "base64").toString("utf8")).not.toContain(KEY);
  });

  it("rejects a changed ciphertext", () => {
    const sealed = encryptApiKey(KEY, SECRET);
    expect(() => decryptApiKey({ ...sealed, ciphertext: flip(sealed.ciphertext) }, SECRET)).toThrow();
  });

  it("rejects a changed tag", () => {
    const sealed = encryptApiKey(KEY, SECRET);
    expect(() => decryptApiKey({ ...sealed, tag: flip(sealed.tag) }, SECRET)).toThrow();
  });

  it("rejects a shortened tag", () => {
    const sealed = encryptApiKey(KEY, SECRET);
    const short = Buffer.from(sealed.tag, "base64").subarray(0, 4).toString("base64");
    expect(() => decryptApiKey({ ...sealed, tag: short }, SECRET)).toThrow();
  });

  it("rejects the wrong secret", () => {
    const sealed = encryptApiKey(KEY, SECRET);
    expect(() => decryptApiKey(sealed, randomBytes(32).toString("base64"))).toThrow();
  });

  it("refuses a secret that is not 32 bytes", () => {
    const short = randomBytes(16).toString("base64");
    expect(() => encryptApiKey(KEY, short)).toThrow("bad-secret");
    expect(() => decryptApiKey(encryptApiKey(KEY, SECRET), short)).toThrow("bad-secret");
    expect(() => encryptApiKey(KEY, "")).toThrow("bad-secret");
  });

  it("keyLast4 gives the last four characters of the trimmed key", () => {
    expect(keyLast4("  abcd-1234  ")).toBe("1234");
  });
});
