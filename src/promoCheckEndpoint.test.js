import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../api/promo-check.js";
import { runPromoCheck } from "./lib/promoCheck.js";

vi.mock("resend", () => ({ Resend: class { emails = { send: async () => ({ error: null }) }; } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
vi.mock("./lib/promoCheck.js", async (importOriginal) => ({
  ...(await importOriginal()),
  runPromoCheck: vi.fn(async () => ({ applied: [], restored: ["Jutro Liflet Avg"], reminders: [] })),
}));

const ENV = {
  CRON_SECRET: "s3cret",
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  RESEND_API_KEY: "re_x",
  EMAIL_TO: "radnja@example.com",
};

const call = async (authorization, method = "GET") => {
  const res = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  await handler({ method, headers: authorization ? { authorization } : {} }, res);
  return res;
};

describe("api/promo-check", () => {
  beforeEach(() => {
    vi.mocked(runPromoCheck).mockClear();
    for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("refuses every call while CRON_SECRET isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await call("Bearer ");
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ ok: false, error: "not-configured" });
    expect(runPromoCheck).not.toHaveBeenCalled();
  });

  it("refuses a call without Vercel Cron's secret", async () => {
    expect((await call()).statusCode).toBe(401);
    expect((await call("Bearer wrong")).statusCode).toBe(401);
    expect(runPromoCheck).not.toHaveBeenCalled();
  });

  it("runs the check for today in Belgrade", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T23:30:00Z"));
    const res = await call("Bearer s3cret");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, applied: [], restored: ["Jutro Liflet Avg"], reminders: [] });
    expect(vi.mocked(runPromoCheck).mock.calls[0][0].today).toBe("2026-11-01");
  });

  it("reports a failed check", async () => {
    vi.mocked(runPromoCheck).mockRejectedValueOnce(new Error("offline"));
    const res = await call("Bearer s3cret");
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ ok: false, error: "server-error" });
  });

  it("takes only the GET that Vercel Cron sends", async () => {
    expect((await call("Bearer s3cret", "POST")).statusCode).toBe(405);
    expect(runPromoCheck).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret of the same length", async () => {
    expect((await call("Bearer s3creT")).statusCode).toBe(401);
  });
});
