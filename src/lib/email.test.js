// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendFileByEmail } from "./email.js";

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
