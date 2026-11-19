import { latestDecisions, runEfakturaAction } from "./efakturaActions.js";
import { WINDOW_DAYS } from "./efakturaRules.js";
import { SEF_BASE_URLS, createSefClient } from "./sefClient.js";
import { createSefMock } from "./sefMock.js";
import { addDays } from "./listFormat.js";
import { belgradeToday } from "./promoCheck.js";

// Server only: the request side of e-Faktura, shared by api/efaktura.js
// (Vercel) and scripts/efakturaDevApi.mjs (`npm run dev`). Checks the
// session, builds the context from the environment and runs the action.
//
// Environment:
//   SEF_ENV          "production" | "demo"; anything else is the test SEF
//   SEF_ACCEPT       "on" lets the app accept and reject on a real SEF
//   EFAKTURA_SECRET  base64 of 32 bytes, seals the SEF key; required in every
//                    mode on a server, so a real key typed in test mode is
//                    never sealed with the public MOCK_SECRET below
//   EMAIL_TO         the shop's address, where invoices are sent for now
//   EFAKTURA_USERS   comma-separated e-mails of the shop's accounts allowed to
//                    use e-Faktura; required for a real SEF, optional in test mode

// The secret `npm run dev` seals test keys with. It is in the repository, so
// it is refused for SEF modes.
export const MOCK_SECRET = "hbB4zcvRESPWKplf2H4NBgxjhC77XAnAyY3pY23jhcE=";

export const modeFromEnv = (env) => (env.SEF_ENV === "production" || env.SEF_ENV === "demo" ? env.SEF_ENV : "mock");

const usableSecret = (secret) => typeof secret === "string" && Buffer.from(secret, "base64").length === 32;

const emailList = (text) =>
  (text ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const contextFromEnv = (env, { store, sendMail, user, now = () => new Date() }) => {
  const mode = modeFromEnv(env);
  const secret = env.EFAKTURA_SECRET;
  if (!usableSecret(secret) || (mode !== "mock" && secret === MOCK_SECRET)) return { error: "not-configured" };
  // Being signed in is not enough on a real SEF: Supabase may let anyone sign
  // up with the public key, and accepting an invoice is binding. Only the
  // shop's accounts listed in EFAKTURA_USERS may; without the list, nobody.
  const allowed = emailList(env.EFAKTURA_USERS);
  if (mode !== "mock" && allowed.length === 0) return { error: "not-configured" };
  if (allowed.length > 0 && !allowed.includes((user.email ?? "").toLowerCase())) return { error: "not-allowed" };
  const sefFor =
    mode === "mock"
      ? (apiKey) =>
          createSefMock({
            apiKey,
            todayIso: belgradeToday(now()),
            decisions: async () => latestDecisions(await store.eventsSince("mock", addDays(belgradeToday(now()), -WINDOW_DAYS))),
          })
      : (apiKey) => createSefClient({ baseUrl: SEF_BASE_URLS[mode], apiKey });
  return {
    mode,
    acceptEnabled: mode === "mock" || env.SEF_ACCEPT === "on",
    secret,
    store,
    sefFor,
    sendMail,
    shopEmail: env.EMAIL_TO,
    user,
    now,
  };
};

const fail = (status, error) => ({ status, json: { ok: false, error } });

// { method, authorization, body } → { status, json } | { status, pdf }.
export const handleEfaktura = async ({ method, authorization, body }, { verifyUser, context }) => {
  try {
    if (method !== "POST") return fail(405, "method-not-allowed");
    const token = typeof authorization === "string" && authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return fail(401, "missing-token");
    const user = await verifyUser(token).catch(() => null);
    if (!user) return fail(401, "invalid-token");
    const ctx = context(user);
    if (ctx.error) return fail(ctx.error === "not-allowed" ? 403 : 500, ctx.error);
    const payload = body && typeof body === "object" ? body : {};
    return await runEfakturaAction(payload.action, payload, ctx);
  } catch (err) {
    console.error("efaktura", "handler", err?.name ?? "error");
    return fail(500, "server-error");
  }
};
