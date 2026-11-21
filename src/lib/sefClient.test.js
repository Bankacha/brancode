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

  it("asks the overview by day, in parts of 28 days, up to tomorrow, and merges by id", async () => {
    // SEF answers one call with about a month at most, and a timed dateTo
    // left the newest invoices out
    const { fetch, calls } = fakeFetch({ body: [dto(1)] }, { body: [dto(2, { status: "Approved" }), dto(1)] }, { body: [dto(3)] });
    const invoices = await client(fetch).overview({ dateFrom: new Date("2026-09-20T00:00:00Z"), dateTo: new Date("2026-11-19T10:00:00Z") });
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(Array(3).fill("/api/publicApi/purchase-invoice/overview"));
    expect(calls.map((c) => Object.fromEntries(new URL(c.url).searchParams))).toEqual([
      { dateFrom: "2026-09-20", dateTo: "2026-10-18" },
      { dateFrom: "2026-10-18", dateTo: "2026-11-15" },
      { dateFrom: "2026-11-15", dateTo: "2026-11-20" },
    ]);
    expect(invoices.map((i) => [i.id, i.status])).toEqual([
      [1, "New"],
      [2, "Approved"],
      [3, "New"],
    ]);
  });

  it("asks a short range in one call", async () => {
    const { fetch, calls } = fakeFetch({ body: [dto(1)] });
    await client(fetch).overview({ dateFrom: new Date("2026-11-18T00:00:00Z"), dateTo: new Date("2026-11-19T23:30:00Z") });
    expect(calls.map((c) => Object.fromEntries(new URL(c.url).searchParams))).toEqual([{ dateFrom: "2026-11-18", dateTo: "2026-11-20" }]);
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

  it("waits for SEF to make a PDF it did not have yet", async () => {
    // SEF answers 200 with this message instead of the file the first time
    const started = { message: "Extended PDF file creation has been initiated for invoice Id 7." };
    const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
    const c = clock();
    const { fetch, calls } = fakeFetch({ body: started }, { body: started }, { body: pdfBytes });
    expect(await client(fetch, c).pdf(7)).toEqual(pdfBytes);
    expect(calls).toHaveLength(3);
    expect(c.sleeps.filter((ms) => ms >= 2000)).toEqual([2000, 3000]);
  });

  it("asks several PDFs first, then again only those SEF was still making", async () => {
    // one wait for all of them, not one per invoice
    const started = { message: "Extended PDF file creation has been initiated for invoice Id 2." };
    const pdfBytes = (n) => new Uint8Array([37, 80, 68, 70, n]);
    const c = clock();
    const { fetch, calls } = fakeFetch({ body: pdfBytes(1) }, { body: started }, { body: pdfBytes(3) }, { body: pdfBytes(2) });
    const got = await client(fetch, c).pdfMany([1, 2, 3]);
    expect(calls.map((call) => new URL(call.url).searchParams.get("invoiceId"))).toEqual(["1", "2", "3", "2"]);
    expect([...got.keys()].sort()).toEqual([1, 2, 3]);
    expect(got.get(2)).toEqual(pdfBytes(2));
    expect(c.sleeps.filter((ms) => ms >= 2000)).toEqual([2000]);
  });

  it("gives each PDF it could not get its error, and stops on a refused key", async () => {
    const started = { message: "Extended PDF file creation has been initiated." };
    const { fetch } = fakeFetch({ status: 503, body: "down" }, { body: started }, { body: started }, { body: started }, { body: started });
    const got = await client(fetch).pdfMany([1, 2]);
    expect(got.get(1)).toMatchObject({ code: "sef-unavailable" });
    expect(got.get(2)).toMatchObject({ code: "pdf-not-ready" });
    const refused = fakeFetch({ status: 401, body: "" });
    await expect(client(refused.fetch).pdfMany([1])).rejects.toMatchObject({ code: "key-rejected" });
  });

  it("stops waiting for PDFs at the deadline, so the mail still has time to go", async () => {
    const started = { message: "Extended PDF file creation has been initiated." };
    const c = clock();
    const { fetch, calls } = fakeFetch({ body: started }, { body: started });
    const got = await client(fetch, c).pdfMany([1, 2], { until: c.now() + 1500 });
    expect(calls).toHaveLength(2);
    expect([...got.values()].map((e) => e.code)).toEqual(["pdf-not-ready", "pdf-not-ready"]);
    expect(c.sleeps.filter((ms) => ms >= 2000)).toEqual([]);
    const late = fakeFetch();
    const none = await client(late.fetch, c).pdfMany([3], { until: c.now() - 1 });
    expect(late.calls).toHaveLength(0);
    expect(none.get(3).code).toBe("pdf-not-ready");
  });

  it("gives up with pdf-not-ready when SEF still has no PDF", async () => {
    const started = { message: `Extended PDF file creation has been initiated for invoice Id 7. ${KEY}` };
    const { fetch, calls } = fakeFetch({ body: started }, { body: started }, { body: started }, { body: started });
    const error = await client(fetch).pdf(7).catch((e) => e);
    expect(error).toBeInstanceOf(SefError);
    expect(error.code).toBe("pdf-not-ready");
    expect(JSON.stringify(error)).not.toContain(KEY);
    expect(calls).toHaveLength(4);
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

