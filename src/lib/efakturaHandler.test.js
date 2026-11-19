import { describe, it, expect, vi, beforeEach } from "vitest";
import { MOCK_SECRET, contextFromEnv, handleEfaktura, modeFromEnv } from "./efakturaHandler.js";
import { createMemoryEfakturaStore } from "./efakturaMemoryStore.js";

const SECRET = Buffer.alloc(32, 7).toString("base64");
const user = { id: "u1", email: "brat@primer.test", emailConfirmed: true };
const deps = (env) => ({ store: createMemoryEfakturaStore(), sendMail: async () => {}, user, now: () => new Date("2026-11-19T09:00:00Z") });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("modeFromEnv", () => {
  it("is mock unless production or demo is set", () => {
    expect(modeFromEnv({ SEF_ENV: "production" })).toBe("production");
    expect(modeFromEnv({ SEF_ENV: "demo" })).toBe("demo");
    expect(modeFromEnv({ SEF_ENV: "Production" })).toBe("mock");
    expect(modeFromEnv({})).toBe("mock");
  });

  it("keeps preview deploys on the test SEF whatever SEF_ENV says", () => {
    expect(modeFromEnv({ SEF_ENV: "production", VERCEL_ENV: "preview" })).toBe("mock");
    expect(modeFromEnv({ SEF_ENV: "demo", VERCEL_ENV: "development" })).toBe("mock");
    expect(modeFromEnv({ SEF_ENV: "production", VERCEL_ENV: "production" })).toBe("production");
  });
});

describe("contextFromEnv", () => {
  it("allows accepting in the test mode, and on SEF only with SEF_ACCEPT=on", () => {
    expect(contextFromEnv({ EFAKTURA_SECRET: SECRET }, deps()).acceptEnabled).toBe(true);
    expect(contextFromEnv({ SEF_ENV: "production", EFAKTURA_SECRET: SECRET, EFAKTURA_USERS: "brat@primer.test" }, deps()).acceptEnabled).toBe(false);
    expect(contextFromEnv({ SEF_ENV: "production", EFAKTURA_SECRET: SECRET, EFAKTURA_USERS: "brat@primer.test", SEF_ACCEPT: "on" }, deps()).acceptEnabled).toBe(true);
    expect(contextFromEnv({ SEF_ENV: "demo", EFAKTURA_SECRET: SECRET, EFAKTURA_USERS: "brat@primer.test", SEF_ACCEPT: "yes" }, deps()).acceptEnabled).toBe(false);
  });

  it("needs EFAKTURA_SECRET in every mode, so a real key is never sealed with the public test secret", () => {
    for (const SEF_ENV of ["production", "demo", undefined]) {
      expect(contextFromEnv({ SEF_ENV }, deps())).toEqual({ error: "not-configured" });
    }
  });

  it("lets only the shop's accounts use a real SEF", () => {
    const env = { SEF_ENV: "production", EFAKTURA_SECRET: SECRET };
    // without the list nobody may, so a stranger who signs up gets nothing
    expect(contextFromEnv(env, deps())).toEqual({ error: "not-configured" });
    expect(contextFromEnv({ ...env, EFAKTURA_USERS: " , " }, deps())).toEqual({ error: "not-configured" });
    expect(contextFromEnv({ ...env, EFAKTURA_USERS: "neko@drugi.test" }, deps())).toEqual({ error: "not-allowed" });
    expect(contextFromEnv({ ...env, EFAKTURA_USERS: "radnja@primer.test, Brat@Primer.test" }, deps()).mode).toBe("production");
  });

  it("counts an account on the list only once its e-mail is confirmed", () => {
    // a stranger who signs up with a listed address that has no account yet
    const unconfirmed = { ...deps(), user: { id: "u2", email: "brat@primer.test", emailConfirmed: false } };
    expect(contextFromEnv({ SEF_ENV: "production", EFAKTURA_SECRET: SECRET, EFAKTURA_USERS: "brat@primer.test" }, unconfirmed)).toEqual({ error: "not-allowed" });
  });

  it("lets any signed-in user try the test mode unless a list is set", () => {
    expect(contextFromEnv({ EFAKTURA_SECRET: SECRET }, deps()).mode).toBe("mock");
    expect(contextFromEnv({ EFAKTURA_SECRET: SECRET, EFAKTURA_USERS: "neko@drugi.test" }, deps())).toEqual({ error: "not-allowed" });
  });

  it("refuses the public test secret outside the test mode", () => {
    expect(contextFromEnv({ SEF_ENV: "production", EFAKTURA_SECRET: MOCK_SECRET }, deps())).toEqual({ error: "not-configured" });
    expect(contextFromEnv({ EFAKTURA_SECRET: MOCK_SECRET }, deps()).mode).toBe("mock");
  });

  it("uses the test SEF in the test mode and the real one otherwise", async () => {
    const mock = contextFromEnv({ EFAKTURA_SECRET: SECRET, EMAIL_TO: "radnja@primer.test" }, deps());
    expect(mock).toMatchObject({ mode: "mock", secret: SECRET, shopEmail: "radnja@primer.test", user });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await mock.sefFor("proba").overview({ dateFrom: new Date("2026-11-01"), dateTo: new Date("2026-11-19T12:00:00Z") })).length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    const real = contextFromEnv({ SEF_ENV: "demo", EFAKTURA_SECRET: SECRET, EFAKTURA_USERS: "brat@primer.test" }, deps());
    expect(real.sefFor("x")).toHaveProperty("acceptReject");
  });
});

describe("handleEfaktura", () => {
  const run = (request, verifyUser = async () => user, context = () => contextFromEnv({ EFAKTURA_SECRET: SECRET }, deps())) =>
    handleEfaktura({ method: "POST", authorization: "Bearer tok", body: { action: "status" }, ...request }, { verifyUser, context });

  it("answers POST only", async () => {
    expect(await run({ method: "GET" })).toEqual({ status: 405, json: { ok: false, error: "method-not-allowed" } });
  });

  it("needs a valid session token", async () => {
    expect(await run({ authorization: undefined })).toEqual({ status: 401, json: { ok: false, error: "missing-token" } });
    expect(await run({ authorization: "Basic x" })).toEqual({ status: 401, json: { ok: false, error: "missing-token" } });
    expect(await run({}, async () => null)).toEqual({ status: 401, json: { ok: false, error: "invalid-token" } });
    const throwing = async () => {
      throw new Error("auth down");
    };
    expect(await run({}, throwing)).toEqual({ status: 401, json: { ok: false, error: "invalid-token" } });
  });

  it("reports a server without its settings", async () => {
    expect(await run({}, undefined, () => ({ error: "not-configured" }))).toEqual({ status: 500, json: { ok: false, error: "not-configured" } });
  });

  it("refuses an account that is not on the shop's list", async () => {
    expect(await run({}, undefined, () => ({ error: "not-allowed" }))).toEqual({ status: 403, json: { ok: false, error: "not-allowed" } });
  });

  it("runs the action for the signed-in user", async () => {
    expect((await run({})).json).toMatchObject({ ok: true, mode: "mock", connected: false });
    expect(await run({ body: { action: "nope" } })).toEqual({ status: 400, json: { ok: false, error: "bad-action" } });
    expect(await run({ body: null })).toEqual({ status: 400, json: { ok: false, error: "bad-action" } });
  });

  it("turns an unexpected failure into server-error, logging only its name", async () => {
    const res = await run({}, undefined, () => {
      throw new TypeError("secret stuff");
    });
    expect(res).toEqual({ status: 500, json: { ok: false, error: "server-error" } });
    expect(console.error).toHaveBeenCalledWith("efaktura", "handler", "TypeError");
  });
});
