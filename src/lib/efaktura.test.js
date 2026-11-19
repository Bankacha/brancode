// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EfakturaError, efakturaCall, efakturaErrorText, efakturaPdf } from "./efaktura.js";

const session = vi.hoisted(() => ({ current: { access_token: "tok" } }));
vi.mock("../supabaseClient.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: session.current } }) } },
}));

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("efakturaCall", () => {
  let fetchMock;
  beforeEach(() => {
    session.current = { access_token: "tok" };
    fetchMock = vi.fn(async () => json(200, { ok: true, connected: false }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts the action, signed in", async () => {
    expect(await efakturaCall("accept", { invoiceIds: [1, 2] })).toEqual({ ok: true, connected: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/efaktura");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ action: "accept", invoiceIds: [1, 2] });
  });

  it("throws the server's error code, with what it answered", async () => {
    fetchMock.mockResolvedValueOnce(json(502, { ok: false, error: "key-rejected", results: [{ id: 1, outcome: "done" }] }));
    const error = await efakturaCall("accept", { invoiceIds: [1, 2] }).catch((e) => e);
    expect(error).toBeInstanceOf(EfakturaError);
    expect(error.code).toBe("key-rejected");
    expect(error.body.results).toEqual([{ id: 1, outcome: "done" }]);
  });

  it("calls an answer without a code a server error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 500 }));
    await expect(efakturaCall("status")).rejects.toMatchObject({ code: "server-error" });
  });

  it("calls a failed request a network problem", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(efakturaCall("status")).rejects.toMatchObject({ code: "network" });
  });

  it("needs a session", async () => {
    session.current = null;
    await expect(efakturaCall("status")).rejects.toMatchObject({ code: "no-session" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("efakturaPdf", () => {
  beforeEach(() => {
    session.current = { access_token: "tok" };
  });
  afterEach(() => vi.unstubAllGlobals());

  it("gives the PDF as a Blob", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { "Content-Type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetchMock);
    const blob = await efakturaPdf(7);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBe(4);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "pdf", invoiceId: 7 });
  });

  it("throws the server's code when there is no PDF", async () => {
    vi.stubGlobal("fetch", async () => json(502, { ok: false, error: "sef-unavailable" }));
    await expect(efakturaPdf(7)).rejects.toMatchObject({ code: "sef-unavailable" });
  });
});

describe("efakturaErrorText", () => {
  it("says what went wrong in Serbian", () => {
    expect(efakturaErrorText("network")).toBe("Nema veze. Proveri internet pa probaj ponovo.");
    expect(efakturaErrorText("key-rejected")).toBe("SEF ne prihvata ovaj ključ. Proveri da li je status ključa Aktivan.");
    expect(efakturaErrorText("sef-unavailable")).toBe("SEF trenutno ne odgovara. Pokušaj ponovo.");
    expect(efakturaErrorText("not-configured")).toBe("e-Faktura nije podešena na serveru.");
    expect(efakturaErrorText("accept-disabled")).toBe("Prihvatanje još nije uključeno");
    expect(efakturaErrorText("send-failed")).toBe("Mejl nije poslat. Pokušaj ponovo.");
    expect(efakturaErrorText("not-connected")).toBe("e-Faktura nije povezana.");
    expect(efakturaErrorText("not-allowed")).toBe("Ovaj nalog nema pristup e-Fakturi.");
    expect(efakturaErrorText("server-error")).toBe("Nešto nije u redu. Pokušaj ponovo.");
    expect(efakturaErrorText(undefined)).toBe("Nešto nije u redu. Pokušaj ponovo.");
  });
});
