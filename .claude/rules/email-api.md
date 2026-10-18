---
paths:
  - "api/**/*.js"
---

# Email endpoint

- `api/send-email.js` is a Vercel serverless function and the only server code in the repo.
- The client (`sendFileByEmail` in `src/lib/email.js`; `sendSheetByEmail` wraps it for the price-tag sheet) posts `{ filename, base64, subject? }` with the user's Supabase access token as `Authorization: Bearer …`. The function verifies it with `supabase.auth.getUser` before sending.
- `subject` is optional and flattened to one line (max 150 chars); without it the mail is titled `Cenovnik – <filename>` as before. Popis sends `Popis – <name>`. The endpoint's tests live in `src/emailEndpoint.test.js` — never put test files in `api/`, Vercel would deploy them as functions.
- Mail goes through Resend from `onboarding@resend.dev` to the fixed `EMAIL_TO` address.
- Env vars on Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `EMAIL_TO`.
- The body is capped at `MAX_BASE64_LENGTH` (~3 MB decoded) to stay under Vercel's 4.5 MB request limit.
- Failures return `{ ok: false, error: "<kebab-case-code>" }` with a matching status; the client turns 413 into `file-too-large` (the app offers the download instead) and anything else into `send-failed`.
