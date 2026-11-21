import { decryptApiKey, encryptApiKey, keyLast4 } from "./efakturaCrypto.js";
import { MAX_MAIL_BYTES, attachmentNames, invoiceMail, mergedFilename, splitBySize } from "./efakturaMail.js";
import { mergePdfs } from "./efakturaPdf.js";
import { PENDING_STATUSES, WINDOW_DAYS, isPending, sendState } from "./efakturaRules.js";
import { SefError } from "./sefClient.js";
import { addDays } from "./listFormat.js";
import { belgradeToday } from "./promoCheck.js";

// Server only: everything api/efaktura.js can be asked to do, for one signed-in
// user (spec docs/superpowers/specs/2026-11-17-brancode-e-faktura-design.md).
// `ctx` brings the mode, the store, SEF (real or test), mail and the clock, so
// this runs the same on Vercel, under `npm run dev` and in tests. The SEF key
// leaves the store only sealed, is opened in memory just to call SEF, and is
// never returned or logged; logs carry an action and an error code only.

const MAX_IDS = 50;
const MAX_COMMENT = 500;
const MAX_SHOP_NAME = 100;
const MAX_PDF_BYTES = 4.4 * 1024 * 1024; // Vercel answers at most 4.5 MB
const PENDING = new Set(PENDING_STATUSES);

const ok = (json = {}) => ({ status: 200, json: { ok: true, ...json } });
const fail = (status, error, extra = {}) => ({ status, json: { ok: false, error, ...extra } });

const isConnected = (settings) => Boolean(settings?.keyCiphertext);

const statusJson = (settings, ctx) => ({
  mode: ctx.mode,
  acceptEnabled: ctx.acceptEnabled,
  connected: isConnected(settings),
  keyLast4: settings?.keyLast4 ?? null,
  shopName: settings?.shopName ?? null,
  pib: settings?.pib ?? null,
  shopEmail: ctx.shopEmail,
  sendTo: settings?.sendTo ?? ctx.shopEmail,
  connectedAt: settings?.connectedAt ?? null,
});

// The last 60 days, as SEF's overview and our history are asked for them.
const windowOf = (ctx) => {
  const startIso = addDays(belgradeToday(ctx.now()), -WINDOW_DAYS);
  return { startIso, range: { dateFrom: new Date(`${startIso}T00:00:00Z`), dateTo: ctx.now() } };
};

const openSef = (settings, ctx) => ctx.sefFor(decryptApiKey({ ciphertext: settings.keyCiphertext, iv: settings.keyIv, tag: settings.keyTag }, ctx.secret));

const idsProblem = (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return "invalid-ids";
  if (ids.length > MAX_IDS) return "too-many";
  if (!ids.every((id) => Number.isInteger(id) && id > 0) || new Set(ids).size !== ids.length) return "invalid-ids";
  return null;
};

// Each invoice's last decision taken through the app (accepted or rejected).
export const latestDecisions = (events) => {
  const decisions = new Map();
  for (const event of events) if (event.action !== "sent") decisions.set(event.invoiceId, event.action);
  return decisions;
};

const record = async (ctx, event) => {
  try {
    await ctx.store.addEvent({ mode: ctx.mode, userId: ctx.user.id, userEmail: ctx.user.email, ...event });
  } catch (err) {
    // SEF already holds the decision or the mail went out; the list still
    // shows it from SEF's status, only the "who" is missing.
    console.error("efaktura", "history", err?.code ?? err?.name ?? "error");
  }
};

const status = async (_, ctx) => ok(statusJson(await ctx.store.getSettings(ctx.mode), ctx));

const saveSettings = async ({ shopName, pib, apiKey }, ctx) => {
  const name = typeof shopName === "string" ? shopName.trim() : "";
  if (name.length === 0 || name.length > MAX_SHOP_NAME) return fail(400, "invalid-shop-name");
  const taxId = typeof pib === "string" ? pib.trim() : "";
  if (!/^\d{9}$/.test(taxId)) return fail(400, "invalid-pib");
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  const current = await ctx.store.getSettings(ctx.mode);
  if (!key && !isConnected(current)) return fail(400, "missing-key");

  const fields = { shopName: name, pib: taxId, updatedBy: ctx.user.email };
  let invoices = null;
  if (key) {
    const sef = ctx.sefFor(key);
    await sef.checkKey();
    // The invoice list surely needs a valid key (the version call may not):
    // a mistyped replacement must not overwrite the working key.
    invoices = await sef.overview(windowOf(ctx).range);
    const sealed = encryptApiKey(key, ctx.secret);
    Object.assign(fields, { keyCiphertext: sealed.ciphertext, keyIv: sealed.iv, keyTag: sealed.tag, keyLast4: keyLast4(key) });
  }
  // Until something is done through the app (no history in this mode), every
  // save takes the baseline again, key or not: 0.15.2 read SEF's answer as an
  // empty list and 0.15.4 saw only its last month, so the shop connected with
  // a short list of what was already accepted.
  const retake = Boolean(current?.connectedAt) && (await ctx.store.eventsSince(ctx.mode, "2000-01-01")).length === 0;
  if (!current?.connectedAt || retake) {
    invoices ??= await openSef(current, ctx).overview(windowOf(ctx).range);
    // what is already accepted now was printed and carried: never offered for sending
    fields.connectedAt = ctx.now().toISOString();
    fields.baselineIds = invoices.filter((invoice) => invoice.status === "Approved").map((invoice) => invoice.id);
  }
  return ok(statusJson(await ctx.store.saveSettings(ctx.mode, fields), ctx));
};

const removeKey = async (_, ctx) =>
  ok(statusJson(await ctx.store.saveSettings(ctx.mode, { keyCiphertext: null, keyIv: null, keyTag: null, keyLast4: null, updatedBy: ctx.user.email }), ctx));

const list = async (_, ctx) => {
  const settings = await ctx.store.getSettings(ctx.mode);
  if (!isConnected(settings)) return fail(409, "not-connected");
  const { startIso, range } = windowOf(ctx);
  const invoices = await openSef(settings, ctx).overview(range);
  const events = await ctx.store.eventsSince(ctx.mode, startIso);
  const lastSent = new Map();
  const decisions = new Map();
  for (const event of events) {
    if (event.action === "sent") lastSent.set(event.invoiceId, { at: event.createdAt, to: event.recipient });
    else decisions.set(event.invoiceId, { action: event.action, userEmail: event.userEmail, at: event.createdAt, comment: event.comment });
  }
  let baselineIds = new Set(settings.baselineIds);
  // Until something is done through the app in this mode, whatever SEF shows
  // accepted was handled the old way (printed and carried): the baseline
  // follows SEF and freezes with the first accept, reject or send. 0.15.2 and
  // 0.15.4 connected the shop with a short list, which left 694 old invoices
  // waiting for sending, all ticked.
  if (events.length === 0 && (await ctx.store.eventsSince(ctx.mode, "2000-01-01")).length === 0) {
    const approved = invoices.filter((invoice) => invoice.status === "Approved").map((invoice) => invoice.id);
    if (approved.length !== baselineIds.size || approved.some((id) => !baselineIds.has(id))) await ctx.store.saveSettings(ctx.mode, { baselineIds: approved });
    baselineIds = new Set(approved);
  }
  return ok({
    invoices: invoices.map((invoice) => {
      const state = sendState(invoice, { baselineIds, lastSent });
      const sent = lastSent.get(invoice.id);
      return {
        ...invoice,
        send: state && { state, lastSentAt: sent?.at ?? null, lastSentTo: sent?.to ?? null },
        decision: decisions.get(invoice.id) ?? null,
      };
    }),
  });
};

const pdf = async ({ invoiceId }, ctx) => {
  if (idsProblem([invoiceId])) return fail(400, "invalid-ids");
  const settings = await ctx.store.getSettings(ctx.mode);
  if (!isConnected(settings)) return fail(409, "not-connected");
  const bytes = await openSef(settings, ctx).pdf(invoiceId);
  if (bytes.length > MAX_PDF_BYTES) return fail(413, "pdf-too-large");
  return { status: 200, pdf: bytes };
};

// Accepting or rejecting, one invoice after another. An invoice counts as
// done only when SEF says so: a clear success, or — when the answer is
// unclear — its status read back. A refused key stops everything.
const decide = async (ids, accepted, comment, ctx) => {
  const settings = await ctx.store.getSettings(ctx.mode);
  if (!isConnected(settings)) return fail(409, "not-connected");
  const sef = openSef(settings, ctx);
  const byId = new Map((await sef.overview(windowOf(ctx).range)).map((invoice) => [invoice.id, invoice]));
  const target = accepted ? "Approved" : "Rejected";
  const results = [];
  for (const id of ids) {
    const invoice = byId.get(id);
    if (!invoice) {
      results.push({ id, outcome: "not-found" });
      continue;
    }
    if (!isPending(invoice)) {
      results.push({ id, outcome: "already", status: invoice.status });
      continue;
    }
    let done = false;
    let refused = false; // SEF answered no: whatever the status is now, it isn't our doing
    let message = null;
    try {
      const answer = await sef.acceptReject({ invoiceId: id, accepted, comment });
      done = answer.success;
      refused = !answer.success;
      message = answer.message;
    } catch (err) {
      if (err?.code === "key-rejected") return fail(502, "key-rejected", { results });
      refused = err?.code === "sef-error"; // a 4xx is an answer; a timeout or 5xx is not
      message = err?.detail || null;
    }
    if (!done) {
      let now;
      try {
        now = await sef.invoiceStatus(id);
      } catch (err) {
        if (err?.code === "key-rejected") return fail(502, "key-rejected", { results });
        results.push({ id, outcome: "unconfirmed" });
        continue;
      }
      if (now !== target || refused) {
        // decided elsewhere meanwhile (no history row in this user's name), or still waiting
        if (!PENDING.has(now)) results.push({ id, outcome: "already", status: now });
        else results.push({ id, outcome: "failed", status: now, ...(message && { message }) });
        continue;
      }
    }
    await record(ctx, { invoiceId: id, action: accepted ? "accepted" : "rejected", comment: accepted ? null : comment, snapshot: { ...invoice, status: target } });
    results.push({ id, outcome: "done" });
  }
  return ok({ results });
};

const accept = async ({ invoiceIds }, ctx) => {
  if (!ctx.acceptEnabled) return fail(403, "accept-disabled");
  const problem = idsProblem(invoiceIds);
  if (problem) return fail(400, problem);
  return decide(invoiceIds, true, "", ctx);
};

const reject = async ({ invoiceId, comment }, ctx) => {
  if (!ctx.acceptEnabled) return fail(403, "accept-disabled");
  if (idsProblem([invoiceId])) return fail(400, "invalid-ids");
  const reason = typeof comment === "string" ? comment.trim() : "";
  if (reason.length === 0 || reason.length > MAX_COMMENT) return fail(400, "invalid-comment");
  return decide([invoiceId], false, reason, ctx);
};

// One mail with a PDF per accepted invoice (several numbered mails over the
// size limit). An invoice is recorded as sent only after its mail went out.
const send = async ({ invoiceIds }, ctx) => {
  const problem = idsProblem(invoiceIds);
  if (problem) return fail(400, problem);
  const settings = await ctx.store.getSettings(ctx.mode);
  if (!isConnected(settings)) return fail(409, "not-connected");
  const sef = openSef(settings, ctx);
  const byId = new Map((await sef.overview(windowOf(ctx).range)).map((invoice) => [invoice.id, invoice]));
  const outcome = new Map();
  const sendable = [];
  for (const id of invoiceIds) {
    const invoice = byId.get(id);
    if (invoice?.status === "Approved") sendable.push(invoice);
    else outcome.set(id, "not-sendable");
  }
  // all PDFs at once: SEF makes the missing ones while we wait for the lot
  const pdfs = await sef.pdfMany(sendable.map((invoice) => invoice.id));
  const ready = [];
  for (const invoice of sendable) {
    const pdf = pdfs.get(invoice.id);
    if (pdf instanceof Uint8Array) ready.push({ invoice, bytes: pdf });
    else {
      console.error("efaktura", "send-pdf", pdf?.code ?? pdf?.name ?? "error");
      outcome.set(invoice.id, "failed");
    }
  }
  // printed in the order they came in, oldest first
  ready.sort((a, b) => (a.invoice.receivedAt ?? "\uffff").localeCompare(b.invoice.receivedAt ?? "\uffff") || a.invoice.id - b.invoice.id);

  const to = settings.sendTo ?? ctx.shopEmail;
  const names = attachmentNames(ready.map((r) => r.invoice));
  const mails = splitBySize(
    ready.map((r) => r.bytes.length),
    MAX_MAIL_BYTES
  );
  const todayIso = belgradeToday(ctx.now());
  for (const [index, part] of mails.entries()) {
    const invoices = part.map((i) => ready[i].invoice);
    const numbering = { index: index + 1, count: mails.length };
    const mail = invoiceMail({ shopName: settings.shopName, pib: settings.pib, invoices, todayIso, mock: ctx.mode === "mock", part: numbering });
    // one file to print; a PDF pdf-lib can't read goes on its own, not lost
    const merged = await mergePdfs(part.map((i) => ready[i].bytes));
    const attachments = [
      ...(merged.bytes ? [{ filename: mergedFilename(todayIso, numbering), content: merged.bytes }] : []),
      ...merged.failed.map((k) => ({ filename: names[part[k]], content: ready[part[k]].bytes })),
    ];
    try {
      await ctx.sendMail({ to, ...mail, attachments });
    } catch (err) {
      console.error("efaktura", "send-mail", err?.code ?? err?.name ?? "error");
      for (const invoice of invoices) outcome.set(invoice.id, "failed");
      continue;
    }
    for (const invoice of invoices) {
      await record(ctx, { invoiceId: invoice.id, action: "sent", recipient: to, snapshot: invoice });
      outcome.set(invoice.id, "sent");
    }
  }

  const results = invoiceIds.map((id) => ({ id, outcome: outcome.get(id) }));
  if (!results.some((r) => r.outcome === "sent")) return fail(502, "send-failed", { results });
  return ok({ recipient: to, results });
};

const resetMock = async (_, ctx) => {
  if (ctx.mode !== "mock") return fail(400, "not-mock");
  await ctx.store.deleteMockEvents();
  return ok();
};

const ACTIONS = {
  status,
  "save-settings": saveSettings,
  "remove-key": removeKey,
  list,
  pdf,
  accept,
  reject,
  send,
  "reset-mock": resetMock,
};

export const runEfakturaAction = async (action, payload, ctx) => {
  if (typeof action !== "string" || !Object.hasOwn(ACTIONS, action)) return fail(400, "bad-action");
  try {
    return await ACTIONS[action](payload ?? {}, ctx);
  } catch (err) {
    console.error("efaktura", action, err?.code ?? err?.name ?? "error");
    if (err instanceof SefError) return fail(502, err.code);
    return fail(500, "server-error");
  }
};
