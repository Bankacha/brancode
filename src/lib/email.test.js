// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendFileByEmail, sendSheetsByEmail } from "./email.js";

vi.mock("../supabaseClient.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

describe("sendFileByEmail", () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts the file with its own subject, signed in", async () => {
    await sendFileByEmail("popis-2026-10-01_2026-10-18.pdf", new Blob(["%PDF"], { type: "application/pdf" }), { subject: "Popis – Magacin" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/send-email");
    expect(init.headers.Authorization).toBe("Bearer tok");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ filename: "popis-2026-10-01_2026-10-18.pdf", subject: "Popis – Magacin" });
    expect(atob(body.base64)).toBe("%PDF");
  });

  it("tells a file that is too big for email apart from other failures", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 413 });
    await expect(sendFileByEmail("x.pdf", new Blob(["x"]))).rejects.toThrow("file-too-large");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 });
    await expect(sendFileByEmail("x.pdf", new Blob(["x"]))).rejects.toThrow("send-failed");
  });
});

describe("sendSheetsByEmail", () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts every sheet as an attachment of one mail", async () => {
    const buffer = (text) => new TextEncoder().encode(text).buffer;
    await sendSheetsByEmail(
      [
        { filename: "cenovnik-raf.xlsx", buffer: buffer("RAF") },
        { filename: "cenovnik-frizider.xlsx", buffer: buffer("FRIZ") },
      ],
      { subject: "Cenovnici – raf i friz" }
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe("Cenovnici – raf i friz");
    expect(body.files.map((f) => [f.filename, atob(f.base64)])).toEqual([
      ["cenovnik-raf.xlsx", "RAF"],
      ["cenovnik-frizider.xlsx", "FRIZ"],
    ]);
  });
});
