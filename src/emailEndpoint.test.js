import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../api/send-email.js";

const sent = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async (mail) => (sent.push(mail), { error: null }) };
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } }),
}));

const call = async (body) => {
  const res = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  await handler({ method: "POST", headers: { authorization: "Bearer tok" }, body }, res);
  return res;
};

describe("api/send-email", () => {
  beforeEach(() => (sent.length = 0));

  it("titles a price-tag sheet as before when no subject is given", async () => {
    await call({ filename: "cenovnik-raf.xlsx", base64: "AAAA" });
    expect(sent[0].subject).toBe("Cenovnik – cenovnik-raf.xlsx");
    // mail previews leave out the barcode images; Excel shows them
    expect(sent[0].text).toContain("Otvorite prilog u Excel-u");
  });

  it("uses the subject the app sends, on one line", async () => {
    const res = await call({ filename: "popis.pdf", base64: "AAAA", subject: "Popis –\r\n Magacin" });
    expect(res.statusCode).toBe(200);
    expect(sent[0].subject).toBe("Popis – Magacin");
    expect(sent[0].attachments).toEqual([{ filename: "popis.pdf", content: "AAAA" }]);
  });
});
