import { describe, it, expect, afterEach, vi } from "vitest";
import { createSefMock, mockInvoiceDtos, mockPdf } from "./sefMock.js";
import { addDays } from "./listFormat.js";
import { belgradeDateOf } from "./efakturaRules.js";

const DAYS = ["2026-11-19", "2026-03-30", "2027-01-01"];
const ageOf = (dto, todayIso) => (Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${belgradeDateOf(dto.sentDate)}T00:00:00Z`)) / 86400000;
const noDecisions = async () => new Map();
const cents = (n) => Math.round(n * 100);

describe("mockInvoiceDtos", () => {
  for (const today of DAYS) {
    it(`keeps every promise of the spec on ${today}`, () => {
      const dtos = mockInvoiceDtos(today);
      const ages = dtos.map((dto) => ageOf(dto, today));
      const suppliers = new Set(dtos.map((dto) => dto.supplierName));
      expect(suppliers.size).toBeGreaterThanOrEqual(6);
      expect(suppliers.size).toBeLessThanOrEqual(10);
      expect(ages.filter((a) => a === 0).length).toBeGreaterThanOrEqual(2);
      for (const age of [1, 3, 10, 14, 18]) expect(ages).toContain(age);
      const count = (status) => dtos.filter((dto) => dto.status === status).length;
      expect(count("ReNotified")).toBeGreaterThanOrEqual(1);
      expect(count("Approved")).toBeGreaterThanOrEqual(3);
      expect(count("Rejected")).toBeGreaterThanOrEqual(1);
      expect(count("Storno")).toBeGreaterThanOrEqual(1);
      expect(dtos.length).toBeLessThanOrEqual(40);
      expect(Math.max(...ages)).toBeLessThan(40);
      expect(Math.min(...ages)).toBe(0);
      for (const dto of dtos) {
        expect(dto.amount).toBeGreaterThan(0);
        expect(cents(dto.sumWithoutVat) + cents(dto.vatAmount)).toBe(cents(dto.amount));
        expect(dto.dueDate.slice(0, 10)).toBe(addDays(belgradeDateOf(dto.sentDate), 30));
        expect(dto.currency).toBe("RSD");
        expect(Number.isInteger(dto.invoiceId) && dto.invoiceId > 0).toBe(true);
      }
      expect(new Set(dtos.map((dto) => dto.invoiceId)).size).toBe(dtos.length);
    });
  }

  it("gives the same invoices for the same day", () => {
    expect(mockInvoiceDtos("2026-11-19")).toEqual(mockInvoiceDtos("2026-11-19"));
  });

  it("keeps an invoice's id from one day to the next and brings new ones today", () => {
    const yesterday = mockInvoiceDtos("2026-11-18");
    const today = mockInvoiceDtos("2026-11-19");
    const receivedOn = (dtos, day) => dtos.filter((dto) => belgradeDateOf(dto.sentDate) === day);
    const ids = (dtos) => dtos.map((dto) => dto.invoiceId).sort();
    expect(ids(receivedOn(today, "2026-11-18"))).toEqual(ids(receivedOn(yesterday, "2026-11-18")));
    const old = new Set(yesterday.map((dto) => dto.invoiceId));
    expect(receivedOn(today, "2026-11-19").every((dto) => !old.has(dto.invoiceId))).toBe(true);
  });
});

describe("createSefMock", () => {
  const TODAY = "2026-11-19";
  const range = { dateFrom: new Date("2026-09-20T00:00:00Z"), dateTo: new Date("2026-11-19T23:00:00Z") };
  const pendingDto = () => mockInvoiceDtos(TODAY).find((dto) => dto.status === "New");
  const approvedDto = () => mockInvoiceDtos(TODAY).find((dto) => dto.status === "Approved");

  it("lists the invoices as the app's Invoice, inside the range", async () => {
    const sef = createSefMock({ apiKey: "proba", todayIso: TODAY, decisions: noDecisions });
    const all = await sef.overview(range);
    expect(all).toHaveLength(mockInvoiceDtos(TODAY).length);
    expect(all[0]).toHaveProperty("supplier");
    const lastTwoDays = await sef.overview({ dateFrom: new Date("2026-11-18T00:00:00Z"), dateTo: range.dateTo });
    expect(lastTwoDays.length).toBeLessThan(all.length);
    expect(lastTwoDays.every((i) => i.receivedAt >= "2026-11-18")).toBe(true);
  });

  it("applies the decisions taken in the app", async () => {
    const waiting = pendingDto();
    const accepted = approvedDto();
    const decisions = async () =>
      new Map([
        [waiting.invoiceId, "accepted"],
        [accepted.invoiceId, "rejected"],
      ]);
    const sef = createSefMock({ apiKey: "proba", todayIso: TODAY, decisions });
    const byId = new Map((await sef.overview(range)).map((i) => [i.id, i]));
    expect(byId.get(waiting.invoiceId).status).toBe("Approved");
    expect(byId.get(accepted.invoiceId).status).toBe("Rejected");
    expect(await sef.invoiceStatus(waiting.invoiceId)).toBe("Approved");
  });

  it("accepts only an invoice that is waiting", async () => {
    const sef = createSefMock({ apiKey: "proba", todayIso: TODAY, decisions: noDecisions });
    expect(await sef.acceptReject({ invoiceId: pendingDto().invoiceId, accepted: true, comment: "" })).toEqual({ success: true, message: null });
    expect(await sef.acceptReject({ invoiceId: approvedDto().invoiceId, accepted: true, comment: "" })).toEqual({ success: false, message: "Faktura nije na čekanju" });
    await expect(sef.acceptReject({ invoiceId: 1, accepted: true, comment: "" })).rejects.toMatchObject({ code: "sef-error" });
  });

  it("refuses the key 'neispravan' and takes any other", async () => {
    await expect(createSefMock({ apiKey: "neispravan", todayIso: TODAY, decisions: noDecisions }).checkKey()).rejects.toMatchObject({ code: "key-rejected" });
    await expect(createSefMock({ apiKey: "bilo šta", todayIso: TODAY, decisions: noDecisions }).checkKey()).resolves.toBeUndefined();
  });

  it("gives a PDF with the invoice's number", async () => {
    const dto = pendingDto();
    const bytes = await createSefMock({ apiKey: "proba", todayIso: TODAY, decisions: noDecisions }).pdf(dto.invoiceId);
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain(dto.documentNumber.replace(/[()\\]/g, ""));
  });

  describe("never calls fetch", () => {
    const realFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    it("works with fetch gone", async () => {
      globalThis.fetch = vi.fn(() => {
        throw new Error("the mock must not call SEF");
      });
      const sef = createSefMock({ apiKey: "proba", todayIso: TODAY, decisions: noDecisions });
      const id = pendingDto().invoiceId;
      await sef.checkKey();
      await sef.overview(range);
      await sef.acceptReject({ invoiceId: id, accepted: true, comment: "" });
      await sef.invoiceStatus(id);
      await sef.pdf(id);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});

describe("mockPdf", () => {
  it("writes a valid one-page PDF with correct offsets", () => {
    const text = new TextDecoder("latin1").decode(mockPdf(["Čokolada (100 g)", "Đak – šećer ž"]));
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text).toContain("(Cokolada \\(100 g\\)) Tj");
    expect(text).toContain("(Djak - secer z) Tj");
    const xrefAt = Number(text.match(/startxref\n(\d+)\n%%EOF/)[1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const offsets = [...text.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, i) => expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    const length = Number(text.match(/\/Length (\d+)/)[1]);
    const stream = text.slice(text.indexOf("stream\n") + 7, text.indexOf("\nendstream"));
    expect(stream.length).toBe(length);
  });
});
