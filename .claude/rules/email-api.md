---
paths:
  - "api/**/*.js"
---

# Email endpoint

- `api/send-email.js` and `api/promo-check.js` are Vercel serverless functions, the only server code in the repo. `promo-check` keeps its logic in `src/lib/promoCheck.js` / `leafletStore.js` (pure modules, tested there) and imports them.
- The client (`sendFileByEmail` in `src/lib/email.js`; `sendSheetByEmail` wraps it for the price-tag sheet) posts `{ filename, base64, subject? }` with the user's Supabase access token as `Authorization: Bearer …`. The function verifies it with `supabase.auth.getUser` before sending.
- The body is `{ filename, base64, subject? }` for one file or `{ files: [{ filename, base64 }], subject? }` for several (Mix printing sends a shelf and a fridge sheet in one mail); the size limit applies to all attachments together. When every attachment is `.xlsx` the text says to open them in Excel.
- `subject` is optional and flattened to one line (max 150 chars); without it the mail is titled `Cenovnik – <filename>` as before. Popis sends `Popis – <name>`. The endpoint's tests live in `src/emailEndpoint.test.js` — never put test files in `api/`, Vercel would deploy them as functions.
- Mail goes through Resend from `onboarding@resend.dev` to the fixed `EMAIL_TO` address.
- Env vars on Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `EMAIL_TO`; for `promo-check` also `CRON_SECRET` (Vercel Cron sends it as `Authorization: Bearer …`; without it every call is refused with `not-configured`) and `SUPABASE_SERVICE_ROLE_KEY` (server only, bypasses RLS — never in client code).
- `api/promo-check.js` runs from Vercel Cron (`crons` in `vercel.json`, `GET`). Its tests are in `src/promoCheckEndpoint.test.js`; the reminder and restore mails go to `EMAIL_TO` like the price sheets.
- The body is capped at `MAX_BASE64_LENGTH` (~3 MB decoded) to stay under Vercel's 4.5 MB request limit.
- Failures return `{ ok: false, error: "<kebab-case-code>" }` with a matching status; the client turns 413 into `file-too-large` (the app offers the download instead) and anything else into `send-failed`.
