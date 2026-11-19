import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../src/supabaseClient.js";
import { MOCK_SECRET, contextFromEnv, handleEfaktura } from "../src/lib/efakturaHandler.js";
import { createMemoryEfakturaStore } from "../src/lib/efakturaMemoryStore.js";

// `npm run dev` serves /api/efaktura itself (Vite doesn't serve api/), always
// on the test SEF, with the store in memory while the dev server runs and
// mails only logged — no secret is needed. The session is still checked
// against Supabase, as on Vercel.

const readBody = async (req) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  return text;
};

export const createDevMiddleware =
  ({ handle }) =>
  async (req, res) => {
    let body = {};
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      body = {};
    }
    const result = await handle({ method: req.method, authorization: req.headers.authorization, body });
    res.setHeader("Cache-Control", "no-store");
    if (result.pdf) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/pdf");
      res.end(Buffer.from(result.pdf));
      return;
    }
    res.statusCode = result.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result.json));
  };

export const efakturaDevApi = () => ({
  name: "efaktura-dev-api",
  apply: "serve",
  configureServer(server) {
    const store = createMemoryEfakturaStore();
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const env = { SEF_ENV: "mock", EFAKTURA_SECRET: MOCK_SECRET, EMAIL_TO: process.env.EMAIL_TO ?? "radnja@primer.test" };
    const sendMail = async ({ to, subject, attachments }) => {
      console.log(`[e-Faktura dev] ${subject} · ${attachments.length} priloga → ${to}`);
    };
    const verifyUser = async (token) => {
      const { data, error } = await supabase.auth.getUser(token);
      return error || !data?.user ? null : { id: data.user.id, email: data.user.email };
    };
    const handle = (request) => handleEfaktura(request, { verifyUser, context: (user) => contextFromEnv(env, { store, sendMail, user }) });
    server.middlewares.use("/api/efaktura", createDevMiddleware({ handle }));
  },
});
