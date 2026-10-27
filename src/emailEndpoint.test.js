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

  it("sends several price sheets in one mail, telling to open them in Excel", async () => {
    const res = await call({
      files: [
        { filename: "cenovnik-raf.xlsx", base64: "AAAA" },
        { filename: "cenovnik-frizider.xlsx", base64: "BBBB" },
      ],
      subject: "Cenovnici – raf i friz",
    });
    expect(res.statusCode).toBe(200);
    expect(sent[0].subject).toBe("Cenovnici – raf i friz");
    expect(sent[0].attachments).toEqual([
      { filename: "cenovnik-raf.xlsx", content: "AAAA" },
      { filename: "cenovnik-frizider.xlsx", content: "BBBB" },
    ]);
    expect(sent[0].text).toContain("Otvorite priloge u Excel-u");
  });

  it("refuses attachments that are too big together", async () => {
    const half = "A".repeat(2.5 * 1024 * 1024);
    const res = await call({ files: [{ filename: "a.xlsx", base64: half }, { filename: "b.xlsx", base64: half }] });
    expect(res.statusCode).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it.each([[[]], [[null]], [[{ filename: 5, base64: "AA" }]], [[{ filename: "a.xlsx", base64: 5 }]], [[{ filename: "   ", base64: "AA" }]]])("refuses attachments it can't send: %j", async (files) => {
    const res = await call({ files });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "missing-file" });
  });

  it("titles a single sheet sent as a list like before", async () => {
    await call({ files: [{ filename: "cenovnik-raf.xlsx", base64: "AAAA" }] });
    expect(sent[0].subject).toBe("Cenovnik – cenovnik-raf.xlsx");
    expect(sent[0].text).toContain("Otvorite prilog u Excel-u");
  });
});
