---
paths:
  - "api/efaktura.js"
  - "src/lib/efaktura*.js"
  - "src/lib/sef*.js"
  - "scripts/efakturaDevApi.mjs"
  - "src/screens/Efaktura*.jsx"
  - "src/sheets/InvoiceSheet.jsx"
  - "src/components/InvoiceRow.jsx"
  - "supabase/migrations/20261119_efaktura.sql"
---

# e-Faktura (SEF)

Spec: `docs/superpowers/specs/2026-11-17-brancode-e-faktura-design.md`; plan `docs/superpowers/plans/2026-11-19-e-faktura.md`. Official API: `https://efaktura.mfin.gov.rs/swagger/public_v1/swagger.json`.

- **The phone never calls SEF.** SEF has no CORS and the key must not reach a browser. Everything goes through `api/efaktura.js` (one function, `action` in the body). The client is `lib/efaktura.js` (`efakturaCall`, `efakturaPdf`, `efakturaErrorText`); the logic is `lib/efakturaActions.js` (`runEfakturaAction(action, payload, ctx)`), wired by `lib/efakturaHandler.js` (session check, `contextFromEnv`). Client code imports only `efakturaRules.js` and `efaktura.js`: the other e-Faktura modules are for the server and dev, and `node:crypto` lives only in `efakturaCrypto.js`.
- **Modes:**
  - `SEF_ENV` = `production` | `demo`; anything else is the test SEF (`lib/sefMock.js`: made-up invoices computed from today's date, never calls SEF, the key `neispravan` is refused). Settings and history rows carry their mode, so a test on a preview deploy (same database) can't touch the real key, and a preview deploy (`VERCEL_ENV` other than `production`) always gets the test SEF, whatever `SEF_ENV` says. The switches are read as typed on Vercel: case, spaces and quotes around the value don't count (`envWord` in `efakturaHandler.js`); `EFAKTURA_USERS` may separate addresses with commas, semicolons, spaces or new lines.
  - `SEF_ACCEPT=on` is needed to accept or reject on a real SEF (otherwise `accept-disabled` and the buttons are locked). Going live is two steps: first only the list, PDFs and sending, then accepting, after comparing the list with SEF.
  - `EFAKTURA_USERS` (comma-separated e-mails) is required for a real SEF; only those accounts may use e-Faktura, and only with a confirmed e-mail (`email_confirmed_at`), otherwise `not-allowed`, 403. A Supabase sign-up with the public key must never be able to accept invoices.
- **The key is never given away:**
  - sealed with AES-256-GCM under `EFAKTURA_SECRET` (base64 of 32 bytes, Vercel only), with a full 16-byte tag;
  - opened in memory just to call SEF;
  - never returned (the app sees `keyLast4`) and never logged. Logs carry an action and an error code only, and `SefError` holds only a code, the HTTP status and a scrubbed short body.
  - `EFAKTURA_SECRET` is required on a server in every mode. `MOCK_SECRET` (in the repo) is used only by `npm run dev` and refused for SEF modes.
- **Tables** (`supabase/migrations/20261119_efaktura.sql`, run by hand in Supabase): RLS on, no policies, no grants for `anon`/`authenticated`; only the service-role key in the function reads them.
  - `efaktura_settings`: one row per mode.
  - `efaktura_events`: the history, append-only by triggers (rows and `TRUNCATE`); only test rows can be deleted, by „Vrati probne fakture“. Each row keeps the invoice as it was, due date included, for a later „Označi kao plaćeno“.
  - `eventsSince` reads every 1000-row page.
- **SEF limits:** 3 calls a second per key, so `sefClient.js` spaces calls by 400 ms within a request (SEF answered 429 at 340) and retries a 429 once. Accept and send take at most 50 invoices per request; the screen sends parts of 20 (accept) and 50 (send: one request, one mail, one PDF). Send asks all PDFs with `pdfMany`, which waits once for the lot SEF is still making (2, 3, 5 s), so a request ends inside the function's limit (`maxDuration` 300 s in `vercel.json`).
- **Accepting counts only what SEF confirms:** `success: true`, or the invoice's status read back when the answer is unclear. Otherwise the outcome is `failed` or `unconfirmed`, never "accepted". An invoice no longer waiting is `already` with its status and no history row: before the call, or when SEF answers no (`success: false` or a 4xx) and the status read back shows someone decided meanwhile. Only an unclear answer (timeout, 5xx) followed by the target status counts as done. The screen calls `already` „accepted“ only when the status is Approved.
- **„Nije poslato“** is every accepted invoice with no `sent` row, except the baseline (`baseline_ids`, shown as „Pre povezivanja“): what SEF showed accepted before anything was done through the app in that mode. Until the first accept, reject or send, every `list` (and every settings save) sets the baseline to all invoices SEF shows accepted; the first history row freezes it. A replaced key keeps it. An invoice is recorded as sent only after Resend took its mail.
- **Mail:** one PDF to print, „Prihvaćene fakture – datum.pdf“ (`mergedFilename`), with every invoice of the mail, oldest first (`mergePdfs` in `efakturaPdf.js`, pdf-lib), without SEF's structured-format pages (`specPages`: only a page titled „Strukturirani format elektronske fakture u skladu sa specifikacijom“ after the first page, carrying the identifier from the first page's SEF header, and the pages after it that carry that identifier and are not invoice pages; anything uncertain stays). A PDF pdf-lib can't read goes as its own attachment („Dobavljač – broj.pdf“). Up to 25 MB per mail (more goes in numbered mails, one PDF each), to `EMAIL_TO` for now. `send_to` waits for a mail domain: Resend's test sender delivers only to the account owner. The test mode puts „[PROBA]“ in the subject. „Otvori PDF“ in the app gives SEF's original, all pages.
- **Window:** invoices received in the last 60 days (`WINDOW_DAYS`); the response deadline is 15 days (`RESPONSE_DAYS`, from expert sources), highlighted from 3, and a re-notified invoice shows „Podsetnik stigao · odgovori odmah“.
- **Learned from the real SEF (21.11.2026, with a temporary probe in 0.15.3):**
  - the answers use capitalised field names (`InvoiceId`, `Status`, `Success`; the swagger says camelCase), so every read goes through `field()` in `sefClient.js`, which takes either;
  - `Status` comes as a name ("Approved");
  - `Amount` = `SumWithoutVat` + `VatAmount`, so it includes VAT;
  - `overview` needs no `status`, but one call covers about a month at most (60 days asked, 31 given), and a `dateTo` with a time left the newest invoices out. So `overview` asks by day (`YYYY-MM-DD`), in parts of 28 days, up to tomorrow, and merges by id;
  - a wrong key gets 401 with an empty body;
  - the extended PDF: invoice pages open with „Generisao sistem eFaktura pod brojem: … | Identifikator: <uuid>“; then the structured-format pages, the first titled „Strukturirani format elektronske fakture u skladu sa specifikacijom prilagođene primene standarda SRPS EN 16931-1…“, each with the same identifier in a footer that writes „еFaktura“ with a Cyrillic е. A temporary `pdf-check` action (0.16.0) reports each page's kind and what `specPages` leaves out, no text; remove it once checked on the shop's invoices;
  - `purchase-invoice/pdf` makes the PDF on the first request for it and answers that request 200 with `{"message": "Extended PDF file creation has been initiated…"}` (85 bytes), not the file. `sefClient.pdf` asks again after 2, 3 and 5 s and otherwise throws `pdf-not-ready` („SEF još pravi PDF…“); sending counts such an invoice as not sent.
  - `acceptRejectPurchaseInvoice` answers `Success` too: the first two real accepts (21.11.2026) were recorded as done, with their history rows.
- **Still to check on real data:**
  - what accepting an already-accepted invoice returns;
  - the 15 + 5-day deadline.
- **`npm run dev` serves `/api/efaktura`** through `scripts/efakturaDevApi.mjs` (Vite plugin, dev only): always the test SEF, the store in memory (`efakturaMemoryStore.js`), mails only logged as `[e-Faktura dev] …`, the session still checked against Supabase. The other `api/` functions still run only on Vercel.
