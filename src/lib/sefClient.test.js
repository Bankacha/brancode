import { describe, it, expect } from "vitest";
import { SEF_BASE_URLS, SefError, createSefClient, normalizeInvoice } from "./sefClient.js";

const KEY = "TAJNI-kljuc-1234";

// A fake clock: sleep advances it, so waits are visible without real time.
const clock = () => {
  let t = 1_000_000;
  const sleeps = [];
  return {
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
};

// fetch that answers from a queue and records every call.
const fakeFetch = (...answers) => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const answer = answers.shift();
    if (!answer) throw new Error("no answer queued");
    if (answer instanceof Error) throw answer;
    const { status = 200, body = "" } = answer;
    return new Response(typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body), { status });
  };
  return { fetch, calls };
};

const client = (fetch, c = clock(), extra = {}) => createSefClient({ baseUrl: SEF_BASE_URLS.demo, apiKey: KEY, fetch, sleep: c.sleep, now: c.now, ...extra });

const dto = (id, fields = {}) => ({
  invoiceId: id,
  documentNumber: `F-${id}`,
  supplierName: "Pekara Klasje d.o.o.",
  supplierVatRegistrationNumber: "101234567",
  status: "New",
  amount: 1200,
  sumWithoutVat: 1000,
  vatAmount: 200,
  currency: "RSD",
  sentDate: "2026-11-19T08:00:00Z",
  dueDate: "2026-12-19T00:00:00",
  ...fields,
});

describe("SEF_BASE_URLS", () => {
  it("points at the official hosts", () => {
    expect(SEF_BASE_URLS).toEqual({ production: "https://efaktura.mfin.gov.rs", demo: "https://demoefaktura.mfin.gov.rs" });
  });
});

describe("createSefClient", () => {
  it("sends the ApiKey header to the configured base url", async () => {
    const { fetch, calls } = fakeFetch({ body: { version: "1" } });
    await client(fetch).checkKey();
    expect(calls[0].url).toBe("https://demoefaktura.mfin.gov.rs/api/publicApi/getEfakturaVersion");
    expect(calls[0].init.headers.ApiKey).toBe(KEY);
    expect(calls[0].url).not.toContain(KEY);
  });

  it("waits at least 400 ms between calls (SEF answered 429 at 340)", async () => {
    const c = clock();
    const { fetch } = fakeFetch({ body: "{}" }, { body: "{}" }, { body: "{}" });
    const sef = client(fetch, c);
    await sef.checkKey();
    await sef.checkKey();
    await sef.checkKey();
    expect(c.sleeps).toEqual([400, 400]);
  });

  it("retries once after 429", async () => {
    const c = clock();
    const { fetch, calls } = fakeFetch({ status: 429 }, { body: { status: "Approved" } });
    expect(await client(fetch, c).invoiceStatus(7)).toBe("Approved");
    expect(calls).toHaveLength(2);
    expect(c.sleeps).toContain(1000);
  });

  it("gives sef-unavailable after a second 429", async () => {
    const { fetch } = fakeFetch({ status: 429 }, { status: 429 });
    await expect(client(fetch).checkKey()).rejects.toMatchObject({ code: "sef-unavailable", httpStatus: 429 });
  });

  it("maps 401 and 403 to key-rejected", async () => {
    for (const status of [401, 403]) {
      const { fetch } = fakeFetch({ status });
      await expect(client(fetch).checkKey()).rejects.toMatchObject({ code: "key-rejected", httpStatus: status });
    }
  });

  it("maps a 5xx, a network error and a timeout to sef-unavailable", async () => {
    const server = fakeFetch({ status: 503 });
    await expect(client(server.fetch).checkKey()).rejects.toMatchObject({ code: "sef-unavailable" });
    const offline = fakeFetch(new TypeError("fetch failed"));
    await expect(client(offline.fetch).checkKey()).rejects.toMatchObject({ code: "sef-unavailable" });
    const hanging = (url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
    await expect(client(hanging, clock(), { timeoutMs: 5 }).checkKey()).rejects.toMatchObject({ code: "sef-unavailable" });
  });

  it("maps any other refusal to sef-error with a short detail", async () => {
    const { fetch } = fakeFetch({ status: 404, body: "x".repeat(500) });
    const error = await client(fetch).checkKey().catch((e) => e);
    expect(error).toBeInstanceOf(SefError);
    expect(error.code).toBe("sef-error");
    expect(error.message).toBe("SEF sef-error (404)");
    expect(error.detail).toHaveLength(200);
  });

  it("asks for the overview of a date range", async () => {
    const { fetch, calls } = fakeFetch({ body: [dto(1), dto(2, { status: "Approved" })] });
    const from = new Date("2026-09-20T00:00:00Z");
    const to = new Date("2026-11-19T10:00:00Z");
    const invoices = await client(fetch).overview({ dateFrom: from, dateTo: to });
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/api/publicApi/purchase-invoice/overview");
    expect(url.searchParams.get("dateFrom")).toBe(from.toISOString());
    expect(url.searchParams.get("dateTo")).toBe(to.toISOString());
    expect(url.searchParams.has("status")).toBe(false);
    expect(invoices.map((i) => [i.id, i.status])).toEqual([
      [1, "New"],
      [2, "Approved"],
    ]);
  });

  it("falls back to one overview call per status on 400 and merges by id", async () => {
    const { fetch, calls } = fakeFetch(
      { status: 400, body: "status is required" },
      { body: [dto(1)] },
      { body: [dto(2, { status: "Seen" })] },
      { body: [] },
      { body: [dto(3, { status: "Approved" }), dto(1)] },
      { body: [] },
      { body: [] }
    );
    const invoices = await client(fetch).overview({ dateFrom: new Date("2026-09-20"), dateTo: new Date("2026-11-19") });
    expect(calls.slice(1).map((c) => new URL(c.url).searchParams.get("status"))).toEqual(["New", "Seen", "ReNotified", "Approved", "Rejected", "Storno"]);
    expect(invoices.map((i) => i.id).sort()).toEqual([1, 2, 3]);
  });

  it("posts accept and reject with the invoice id and comment", async () => {
    const { fetch, calls } = fakeFetch({ body: { success: true, message: null } });
    expect(await client(fetch).acceptReject({ invoiceId: 7, accepted: false, comment: "Pogrešna cena" })).toEqual({ success: true, message: null });
    expect(calls[0].url).toBe("https://demoefaktura.mfin.gov.rs/api/publicApi/purchase-invoice/acceptRejectPurchaseInvoice");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calls[0].init.body)).toEqual({ invoiceId: 7, accepted: false, comment: "Pogrešna cena" });
  });

  it("counts acceptReject as success only for success === true", async () => {
    const answers = [{ body: { success: false, message: "Već obrađena" } }, { body: { message: "?" } }, { body: { success: "true" } }, { body: "<html>ok</html>" }];
    const { fetch } = fakeFetch(...answers);
    const sef = client(fetch);
    const results = [];
    for (let i = 0; i < answers.length; i += 1) results.push(await sef.acceptReject({ invoiceId: 1, accepted: true, comment: "" }));
    expect(results).toEqual([
      { success: false, message: "Već obrađena" },
      { success: false, message: "?" },
      { success: false, message: null },
      { success: false, message: null },
    ]);
  });

  it("reads SEF's real answers, whose fields start with a capital letter", async () => {
    const { fetch } = fakeFetch({ body: { Success: true, Message: null } }, { body: { Success: false, Message: "Već obrađena" } }, { body: { InvoiceId: 7, Status: "Approved" } });
    const sef = client(fetch);
    expect(await sef.acceptReject({ invoiceId: 7, accepted: true, comment: "" })).toEqual({ success: true, message: null });
    expect(await sef.acceptReject({ invoiceId: 7, accepted: true, comment: "" })).toEqual({ success: false, message: "Već obrađena" });
    expect(await sef.invoiceStatus(7)).toBe("Approved");
  });

  it("reads one invoice's status and its PDF", async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    const { fetch, calls } = fakeFetch({ body: { invoiceId: 7, status: "Approved" } }, { body: pdfBytes });
    const sef = client(fetch);
    expect(await sef.invoiceStatus(7)).toBe("Approved");
    expect(await sef.pdf(7)).toEqual(pdfBytes);
    expect(calls.map((c) => new URL(c.url).pathname + new URL(c.url).search)).toEqual([
      "/api/publicApi/purchase-invoice?invoiceId=7",
      "/api/publicApi/purchase-invoice/pdf?invoiceId=7",
    ]);
  });

  it("never puts the key in an error", async () => {
    const thrown = fakeFetch(new Error(`boom https://x?ApiKey=${KEY}`));
    const echoed = fakeFetch({ status: 400, body: `bad key ${KEY}` });
    for (const fetch of [thrown.fetch, echoed.fetch]) {
      const error = await client(fetch).checkKey().catch((e) => e);
      for (const text of [JSON.stringify(error), error.message, error.detail ?? "", error.stack, String(error.cause ?? "")]) {
        expect(text).not.toContain(KEY);
      }
    }
  });
});

describe("normalizeInvoice", () => {
  it("maps the overview fields", () => {
    expect(normalizeInvoice(dto(7))).toEqual({
      id: 7,
      number: "F-7",
      supplier: "Pekara Klasje d.o.o.",
      supplierPib: "101234567",
      amount: 1200,
      amountWithoutVat: 1000,
      vat: 200,
      currency: "RSD",
      status: "New",
      receivedAt: "2026-11-19T08:00:00Z",
      dueDate: "2026-12-19",
      send: null,
      decision: null,
    });
  });

  it("maps the overview fields as SEF really sends them: capitalised", () => {
    const pascal = Object.fromEntries(Object.entries(dto(7)).map(([name, value]) => [name[0].toUpperCase() + name.slice(1), value]));
    expect(normalizeInvoice(pascal)).toEqual(normalizeInvoice(dto(7)));
    expect(normalizeInvoice(pascal).id).toBe(7);
  });

  it("drops a row without an invoice id", () => {
    expect(normalizeInvoice(dto(undefined))).toBeNull();
    expect(normalizeInvoice(dto("x"))).toBeNull();
    expect(normalizeInvoice(null)).toBeNull();
  });

  it("keeps unknown statuses visible as Unknown and fills the gaps", () => {
    const invoice = normalizeInvoice(dto(7, { status: "Mystery", currency: "", dueDate: null, supplierVatRegistrationNumber: null, supplierRegistrationNumber: "07654321", documentNumber: null, supplierName: undefined, sumWithoutVat: null, vatAmount: undefined }));
    expect(invoice).toMatchObject({ status: "Unknown", currency: "RSD", dueDate: null, supplierPib: "07654321", number: "", supplier: "", amountWithoutVat: null, vat: null });
  });
});

describe("probe (temporary: why the real SEF lists nothing)", () => {
  // answers by the request, not by order: the variants are SEF's to judge
  const routedFetch = (route) => {
    const calls = [];
    const fetch = async (url, init = {}) => {
      const u = new URL(String(url));
      calls.push({ path: u.pathname, query: Object.fromEntries(u.searchParams), method: init.method ?? "GET", key: init.headers?.ApiKey });
      const { status = 200, body = "", type = "application/json" } = route(u, init);
      return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": type } });
    };
    return { fetch, calls };
  };
  const range = { dateFrom: new Date("2026-09-22T00:00:00Z"), dateTo: new Date("2026-11-21T14:00:00Z") };

  it("asks the list in several shapes and reports only counts, keys and statuses", async () => {
    const { fetch, calls } = routedFetch((u) => {
      if (u.pathname.endsWith("/overview")) {
        const status = u.searchParams.get("status");
        return { body: status === "Approved" ? [dto(7, { status: "Approved" }), dto(8, { status: "Approved" })] : [] };
      }
      if (u.pathname.endsWith("/ids")) return { body: { purchaseInvoiceIds: [7, 8] } };
      if (u.pathname.endsWith("/changes")) return { body: [] };
      return { body: "3.10.0", type: "text/plain" };
    });
    const results = await client(fetch).probe(range);
    const byName = Object.fromEntries(results.map((r) => [r.name, r]));
    expect(byName["overview iso"]).toEqual({ name: "overview iso", httpStatus: 200, contentType: "application/json", kind: "array", count: 0 });
    expect(byName["overview Approved"]).toMatchObject({ kind: "array", count: 2, statuses: { Approved: 2 }, statusType: "string" });
    expect(byName["overview Approved"].firstKeys).toContain("invoiceId");
    expect(byName["ids iso"]).toMatchObject({ kind: "object", keys: ["purchaseInvoiceIds"], arrays: { purchaseInvoiceIds: 2 } });
    expect(byName["verzija"]).toMatchObject({ kind: "text", length: 6 });
    expect(results.map((r) => r.name)).toEqual([
      "overview iso",
      "overview bez parametara",
      "overview samo datum",
      "overview bez Z",
      "overview New",
      "overview Seen",
      "overview Approved",
      "ids iso",
      "ids Approved",
      "changes danas",
      "verzija",
    ]);
    expect(calls.find((c) => c.path.endsWith("/ids")).method).toBe("POST");
    expect(calls.find((c) => c.path.endsWith("/changes")).query).toEqual({ date: "2026-11-21" });
    const dateOnly = calls[2].query;
    expect(dateOnly).toEqual({ dateFrom: "2026-09-22", dateTo: "2026-11-21" });
    expect(calls[3].query).toEqual({ dateFrom: "2026-09-22T00:00:00", dateTo: "2026-11-21T14:00:00" });
  });

  it("never puts the key in what it reports", async () => {
    const { fetch } = routedFetch(() => ({ status: 401, body: `bad key ${KEY}`, type: "text/plain" }));
    const results = await client(fetch).probe(range);
    expect(JSON.stringify(results)).not.toContain(KEY);
    expect(results[0]).toMatchObject({ httpStatus: 401, kind: "text" });
  });

  it("asks only the cheap calls with a made-up key", async () => {
    const { fetch, calls } = routedFetch(() => ({ body: [] }));
    const results = await client(fetch).probe(range, { short: true });
    expect(results.map((r) => r.name)).toEqual(["overview iso", "verzija"]);
    expect(calls).toHaveLength(2);
  });
});
