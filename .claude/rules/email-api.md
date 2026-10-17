---
paths:
  - "api/**/*.js"
---

# Email endpoint

- `api/send-email.js` is a Vercel serverless function and the only server code in the repo.
- The client (`sendSheetByEmail` in `src/App.jsx`) posts `{ filename, base64 }` with the user's Supabase access token as `Authorization: Bearer …`. The function verifies it with `supabase.auth.getUser` before sending.
- Mail goes through Resend from `onboarding@resend.dev` to the fixed `EMAIL_TO` address.
- Env vars on Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `EMAIL_TO`.
- The body is capped at `MAX_BASE64_LENGTH` (~3 MB decoded) to stay under Vercel's 4.5 MB request limit.
- Failures return `{ ok: false, error: "<kebab-case-code>" }` with a matching status; the client only checks `res.ok`.
