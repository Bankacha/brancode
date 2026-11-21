// Server only (it holds the SEF API key). The real SEF (e-Faktura) public API
// for incoming invoices: https://efaktura.mfin.gov.rs/swagger/public_v1/swagger.json.
// SEF allows 3 calls a second per key, so calls from one request are spaced
// by minGapMs (400 ms: SEF answered 429 at 340) and a 429 is retried once.
// No CORS on SEF: phones never call it.
// Errors carry only a code, the HTTP status and a short scrubbed body; never
// the key, a URL or the underlying error (whose text may hold either).

import { addDays } from "./listFormat.js";

export const SEF_BASE_URLS = {
  production: "https://efaktura.mfin.gov.rs",
  demo: "https://demoefaktura.mfin.gov.rs",
};

// SEF answers one overview call with about a month at most (asked for 60 days
// on 21.11.2026, it gave 31), and a dateTo with a time left the newest invoices
// out. So the list is asked by day, in parts of PART_DAYS, up to tomorrow.
const PART_DAYS = 28;
const dayOf = (date) => date.toISOString().slice(0, 10);

// SEF makes an invoice's PDF on the first request for it: that request gets
// 200 with {"message": "Extended PDF file creation has been initiated…"}
// instead of the file (seen 21.11.2026; a minute later the PDF was there).
// So a body that isn't a PDF is asked again after these waits.
const PDF_RETRY_WAITS_MS = [2000, 3000, 5000];
const isPdf = (bytes) => bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
// PurchaseInvoiceStatus; anything else is shown as Unknown.
const KNOWN_STATUSES = ["New", "Seen", "ReNotified", "Deleted", "Approved", "Rejected", "Cancelled", "Storno", "SendingInProgress", "Unknown"];

export class SefError extends Error {
  constructor(code, httpStatus = null, detail = null) {
    super(`SEF ${code}${httpStatus ? ` (${httpStatus})` : ""}`);
    this.name = "SefError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.detail = detail;
  }
}

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// SEF's swagger names the fields in camelCase (invoiceId), but the real SEF
// answers with capitals (InvoiceId, Status, Success): read either.
const field = (body, name) => body?.[name] ?? body?.[name[0].toUpperCase() + name.slice(1)];

// One PurchaseInvoiceOverviewDto as the app's Invoice; null without a usable id.
export const normalizeInvoice = (dto) => {
  const id = Number(field(dto, "invoiceId"));
  if (!Number.isInteger(id) || id <= 0) return null;
  const status = field(dto, "status");
  const dueDate = field(dto, "dueDate");
  return {
    id,
    number: field(dto, "documentNumber") ?? "",
    supplier: field(dto, "supplierName") ?? "",
    supplierPib: field(dto, "supplierVatRegistrationNumber") ?? field(dto, "supplierRegistrationNumber") ?? null,
    amount: numberOrNull(field(dto, "amount")) ?? 0,
    amountWithoutVat: numberOrNull(field(dto, "sumWithoutVat")),
    vat: numberOrNull(field(dto, "vatAmount")),
    currency: field(dto, "currency") || "RSD",
    status: KNOWN_STATUSES.includes(status) ? status : "Unknown",
    receivedAt: field(dto, "sentDate") ?? null,
    dueDate: typeof dueDate === "string" && dueDate.length >= 10 ? dueDate.slice(0, 10) : null,
    send: null,
    decision: null,
  };
};

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const createSefClient = ({ baseUrl, apiKey, fetch = globalThis.fetch, sleep = realSleep, now = Date.now, minGapMs = 400, timeoutMs = 20000 }) => {
  let lastCallAt = -Infinity;
  const scrub = (text) => (apiKey ? text.split(apiKey).join("***") : text).slice(0, 200);

  const spaced = async () => {
    const wait = lastCallAt + minGapMs - now();
    if (wait > 0) await sleep(wait);
    lastCallAt = now();
  };

  const send = async (path, { method = "GET", query, json } = {}) => {
    await spaced();
    const url = new URL(path, baseUrl);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    const headers = { ApiKey: apiKey, Accept: "application/json" };
    if (json !== undefined) headers["Content-Type"] = "application/json";
    try {
      return await fetch(url, { method, headers, body: json === undefined ? undefined : JSON.stringify(json), signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      // network failure or timeout; its message may hold the URL, so it is dropped
      throw new SefError("sef-unavailable");
    }
  };

  const request = async (path, options) => {
    let res = await send(path, options);
    if (res.status === 429) {
      await sleep(1000);
      res = await send(path, options);
    }
    if (res.ok) return res;
    const detail = scrub(await res.text().catch(() => ""));
    if (res.status === 401 || res.status === 403) throw new SefError("key-rejected", res.status, detail);
    if (res.status === 429 || res.status >= 500) throw new SefError("sef-unavailable", res.status, detail);
    throw new SefError("sef-error", res.status, detail);
  };

  const readJson = async (res) => {
    try {
      return JSON.parse(await res.text());
    } catch {
      return null;
    }
  };

  const client = {
    checkKey: async () => {
      await request("/api/publicApi/getEfakturaVersion");
    },

    // Neighbouring parts share their boundary day; duplicates merge by id.
    overview: async ({ dateFrom, dateTo }) => {
      const last = addDays(dayOf(dateTo), 1);
      const byId = new Map();
      for (let from = dayOf(dateFrom); from < last; from = addDays(from, PART_DAYS)) {
        const to = addDays(from, PART_DAYS) < last ? addDays(from, PART_DAYS) : last;
        const body = await readJson(await request("/api/publicApi/purchase-invoice/overview", { query: { dateFrom: from, dateTo: to } }));
        for (const invoice of (Array.isArray(body) ? body : []).map(normalizeInvoice).filter(Boolean)) byId.set(invoice.id, invoice);
      }
      return [...byId.values()];
    },

    acceptReject: async ({ invoiceId, accepted, comment }) => {
      const body = await readJson(
        await request("/api/publicApi/purchase-invoice/acceptRejectPurchaseInvoice", { method: "POST", json: { invoiceId, accepted, comment } })
      );
      const message = field(body, "message");
      return { success: field(body, "success") === true, message: typeof message === "string" ? message : null };
    },

    invoiceStatus: async (invoiceId) => {
      const body = await readJson(await request("/api/publicApi/purchase-invoice", { query: { invoiceId } }));
      const status = field(body, "status");
      return typeof status === "string" ? status : "Unknown";
    },

    // id → PDF bytes or the SefError for that invoice. All are asked once,
    // then, after each wait, only those SEF was still making: one wait for
    // the lot, not one per invoice. A refused key stops everything.
    pdfMany: async (invoiceIds) => {
      const got = new Map();
      let waiting = [...invoiceIds];
      for (let attempt = 0; waiting.length > 0; attempt += 1) {
        if (attempt > 0) await sleep(PDF_RETRY_WAITS_MS[attempt - 1]);
        const still = [];
        for (const invoiceId of waiting) {
          try {
            const bytes = new Uint8Array(await (await request("/api/publicApi/purchase-invoice/pdf", { query: { invoiceId } })).arrayBuffer());
            if (isPdf(bytes)) got.set(invoiceId, bytes);
            else still.push(invoiceId);
          } catch (err) {
            if (err?.code === "key-rejected") throw err;
            got.set(invoiceId, err);
          }
        }
        waiting = still;
        if (attempt >= PDF_RETRY_WAITS_MS.length) for (const invoiceId of waiting.splice(0)) got.set(invoiceId, new SefError("pdf-not-ready", 200));
      }
      return got;
    },

    pdf: async (invoiceId) => {
      const result = (await client.pdfMany([invoiceId])).get(invoiceId);
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return client;
};
