// Server only (it holds the SEF API key). The real SEF (e-Faktura) public API
// for incoming invoices: https://efaktura.mfin.gov.rs/swagger/public_v1/swagger.json.
// SEF allows 3 calls a second per key, so calls from one request are spaced
// by minGapMs and a 429 is retried once. No CORS on SEF: phones never call it.
// Errors carry only a code, the HTTP status and a short scrubbed body; never
// the key, a URL or the underlying error (whose text may hold either).

export const SEF_BASE_URLS = {
  production: "https://efaktura.mfin.gov.rs",
  demo: "https://demoefaktura.mfin.gov.rs",
};

// The statuses SEF's overview accepts as a filter (PurchaseInvoiceStatusFilter).
const STATUS_FILTERS = ["New", "Seen", "ReNotified", "Approved", "Rejected", "Storno"];
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

// One PurchaseInvoiceOverviewDto as the app's Invoice; null without a usable id.
export const normalizeInvoice = (dto) => {
  const id = Number(dto?.invoiceId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return {
    id,
    number: dto.documentNumber ?? "",
    supplier: dto.supplierName ?? "",
    supplierPib: dto.supplierVatRegistrationNumber ?? dto.supplierRegistrationNumber ?? null,
    amount: numberOrNull(dto.amount) ?? 0,
    amountWithoutVat: numberOrNull(dto.sumWithoutVat),
    vat: numberOrNull(dto.vatAmount),
    currency: dto.currency || "RSD",
    status: KNOWN_STATUSES.includes(dto.status) ? dto.status : "Unknown",
    receivedAt: dto.sentDate ?? null,
    dueDate: typeof dto.dueDate === "string" && dto.dueDate.length >= 10 ? dto.dueDate.slice(0, 10) : null,
    send: null,
    decision: null,
  };
};

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const createSefClient = ({ baseUrl, apiKey, fetch = globalThis.fetch, sleep = realSleep, now = Date.now, minGapMs = 340, timeoutMs = 20000 }) => {
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

  const overviewOnce = async (query) => {
    const body = await readJson(await request("/api/publicApi/purchase-invoice/overview", { query }));
    return (Array.isArray(body) ? body : []).map(normalizeInvoice).filter(Boolean);
  };

  return {
    checkKey: async () => {
      await request("/api/publicApi/getEfakturaVersion");
    },

    overview: async ({ dateFrom, dateTo }) => {
      const range = { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
      try {
        return await overviewOnce(range);
      } catch (e) {
        if (!(e instanceof SefError) || e.httpStatus !== 400) throw e;
      }
      // SEF wants a status: ask once per status and merge
      const byId = new Map();
      for (const status of STATUS_FILTERS) {
        for (const invoice of await overviewOnce({ ...range, status })) byId.set(invoice.id, invoice);
      }
      return [...byId.values()];
    },

    acceptReject: async ({ invoiceId, accepted, comment }) => {
      const body = await readJson(
        await request("/api/publicApi/purchase-invoice/acceptRejectPurchaseInvoice", { method: "POST", json: { invoiceId, accepted, comment } })
      );
      return { success: body?.success === true, message: typeof body?.message === "string" ? body.message : null };
    },

    invoiceStatus: async (invoiceId) => {
      const body = await readJson(await request("/api/publicApi/purchase-invoice", { query: { invoiceId } }));
      return typeof body?.status === "string" ? body.status : "Unknown";
    },

    pdf: async (invoiceId) => new Uint8Array(await (await request("/api/publicApi/purchase-invoice/pdf", { query: { invoiceId } })).arrayBuffer()),

    // Temporary (0.15.3): the real SEF listed nothing for the shop. Asks the
    // list in several shapes and reports, per shape, only the HTTP status and
    // the answer's shape: counts, field names, statuses, never invoice data
    // or the key. `short` asks just the two calls worth trying with a made-up key.
    probe: async ({ dateFrom, dateTo }, { short = false } = {}) => {
      const iso = { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
      const day = (d) => d.toISOString().slice(0, 10);
      const plain = (d) => d.toISOString().slice(0, 19);
      const OVERVIEW = "/api/publicApi/purchase-invoice/overview";
      const IDS = "/api/publicApi/purchase-invoice/ids";
      const variants = [
        ["overview iso", OVERVIEW, "GET", iso],
        ["overview bez parametara", OVERVIEW, "GET", {}],
        ["overview samo datum", OVERVIEW, "GET", { dateFrom: day(dateFrom), dateTo: day(dateTo) }],
        ["overview bez Z", OVERVIEW, "GET", { dateFrom: plain(dateFrom), dateTo: plain(dateTo) }],
        ["overview New", OVERVIEW, "GET", { ...iso, status: "New" }],
        ["overview Seen", OVERVIEW, "GET", { ...iso, status: "Seen" }],
        ["overview Approved", OVERVIEW, "GET", { ...iso, status: "Approved" }],
        ["ids iso", IDS, "POST", iso],
        ["ids Approved", IDS, "POST", { ...iso, status: "Approved" }],
        ["changes danas", "/api/publicApi/purchase-invoice/changes", "POST", { date: day(dateTo) }],
        ["verzija", "/api/publicApi/getEfakturaVersion", "GET", {}],
      ].filter(([name]) => !short || name === "overview iso" || name === "verzija");

      const shape = (text) => {
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          return { kind: "text", length: text.length, head: scrub(text).slice(0, 80) };
        }
        if (Array.isArray(body)) {
          if (body.length === 0) return { kind: "array", count: 0 };
          const statuses = {};
          for (const item of body) statuses[String(item?.status ?? "?")] = (statuses[String(item?.status ?? "?")] ?? 0) + 1;
          return { kind: "array", count: body.length, firstKeys: Object.keys(body[0] ?? {}).slice(0, 30), statuses };
        }
        if (body && typeof body === "object") {
          const arrays = {};
          for (const [name, value] of Object.entries(body)) if (Array.isArray(value)) arrays[name] = value.length;
          return { kind: "object", keys: Object.keys(body).slice(0, 30), arrays };
        }
        return { kind: typeof body, length: String(body).length };
      };

      const results = [];
      for (const [name, path, method, query] of variants) {
        try {
          const res = await send(path, { method, query });
          results.push({ name, httpStatus: res.status, contentType: res.headers.get("content-type"), ...shape(await res.text().catch(() => "")) });
        } catch (e) {
          results.push({ name, error: e?.code ?? "error" });
        }
      }
      return results;
    },
  };
};
