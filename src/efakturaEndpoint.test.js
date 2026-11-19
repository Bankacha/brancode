import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../api/efaktura.js";

const KEY = "TAJNI-1234";
const SECRET = Buffer.alloc(32, 3).toString("base64");

const { memory, sent } = vi.hoisted(() => ({ memory: { store: null }, sent: [] }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async (mail) => (sent.push(mail), { error: null }) };
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async (token) => (token === "tok" ? { data: { user: { id: "u1", email: "brat@primer.test" } }, error: null } : { data: { user: null }, error: new Error("bad jwt") }) },
  }),
}));
vi.mock("./lib/efakturaStore.js", () => ({ createEfakturaStore: () => memory.store }));

const { createMemoryEfakturaStore } = await import("./lib/efakturaMemoryStore.js");

const call = async ({ method = "POST", token = "tok", body } = {}) => {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
  };
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  return res;
};

const ENV = {
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  RESEND_API_KEY: "re",
  EMAIL_TO: "radnja@primer.test",
  EFAKTURA_USERS: "brat@primer.test",
};

beforeEach(() => {
  memory.store = createMemoryEfakturaStore();
  sent.length = 0;
  for (const [name, value] of Object.entries({ ...ENV, EFAKTURA_SECRET: SECRET })) vi.stubEnv(name, value);
  vi.stubEnv("SEF_ENV", "");
  vi.stubEnv("SEF_ACCEPT", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api/efaktura", () => {
  it("answers POST only", async () => {
    expect((await call({ method: "GET" })).statusCode).toBe(405);
  });

  it("needs a valid session", async () => {
    expect((await call({ token: null, body: { action: "status" } })).body).toEqual({ ok: false, error: "missing-token" });
    const res = await call({ token: "stale", body: { action: "status" } });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "invalid-token" });
  });

  it("is not configured on SEF without EFAKTURA_SECRET", async () => {
    vi.stubEnv("SEF_ENV", "production");
    vi.stubEnv("EFAKTURA_SECRET", "");
    const res = await call({ body: { action: "status" } });
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ ok: false, error: "not-configured" });
  });

  it("is not configured without the service-role key", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect((await call({ body: { action: "status" } })).body).toEqual({ ok: false, error: "not-configured" });
  });

  it("refuses a signed-in account that is not the shop's on a real SEF", async () => {
    vi.stubEnv("SEF_ENV", "production");
    vi.stubEnv("EFAKTURA_USERS", "neko@drugi.test");
    const res = await call({ body: { action: "status" } });
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ ok: false, error: "not-allowed" });
  });

  it("refuses an unknown action", async () => {
    const res = await call({ body: { action: "nope" } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("bad-action");
  });

  it("returns a PDF as a PDF", async () => {
    await call({ body: { action: "save-settings", shopName: "Radnja", pib: "101234567", apiKey: "proba-1" } });
    const list = await call({ body: { action: "list" } });
    const res = await call({ body: { action: "pdf", invoiceId: list.body.invoices[0].id } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });

  it("mails the PDFs through Resend as base64", async () => {
    await call({ body: { action: "save-settings", shopName: "Radnja", pib: "101234567", apiKey: "proba-1" } });
    const list = await call({ body: { action: "list" } });
    const accepted = list.body.invoices.find((i) => i.status === "Approved");
    const res = await call({ body: { action: "send", invoiceIds: [accepted.id] } });
    expect(res.body.ok).toBe(true);
    expect(sent[0].to).toBe("radnja@primer.test");
    expect(sent[0].subject.startsWith("[PROBA] ")).toBe(true);
    expect(Buffer.from(sent[0].attachments[0].content, "base64").subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("never logs or returns the key", async () => {
    vi.stubEnv("SEF_ENV", "production");
    let sefDown = false;
    vi.stubGlobal("fetch", async (url, init) => {
      if (sefDown) throw new Error(`boom ${url} ${init.headers.ApiKey}`);
      return new Response(String(url).includes("overview") ? "[]" : "{}", { status: 200 });
    });
    const responses = [await call({ body: { action: "save-settings", shopName: "Radnja", pib: "101234567", apiKey: KEY } })];
    sefDown = true;
    responses.push(await call({ body: { action: "status" } }), await call({ body: { action: "list" } }));
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200, 502]);
    for (const res of responses) expect(JSON.stringify(res.body)).not.toContain("TAJNI");
    expect(JSON.stringify(console.error.mock.calls)).not.toContain("TAJNI");
  });
});
