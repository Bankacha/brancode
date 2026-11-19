import { describe, it, expect } from "vitest";
import { MAX_MAIL_BYTES, attachmentNames, invoiceMail, splitBySize } from "./efakturaMail.js";

const invoice = (id, fields = {}) => ({
  id,
  number: `${id}/2026`,
  supplier: "Pekara Klasje d.o.o.",
  supplierPib: null,
  amount: 1200,
  amountWithoutVat: 1000,
  vat: 200,
  currency: "RSD",
  status: "Approved",
  receivedAt: "2026-11-19T07:00:00Z",
  dueDate: null,
  send: null,
  decision: null,
  ...fields,
});

const two = [invoice(12), invoice(13, { supplier: "Mlečni put d.o.o.", amount: 1234.5 })];

describe("invoiceMail", () => {
  it("writes the subject and the polite text with every invoice", () => {
    const mail = invoiceMail({ shopName: "Radnja Kod Brata", pib: "101234567", invoices: two, todayIso: "2026-11-19", mock: false });
    expect(mail.subject).toBe("Prihvaćene fakture – Radnja Kod Brata – 19.11.2026.");
    expect(mail.text).toBe(
      [
        "Poštovani,",
        "",
        "u prilogu su prihvaćene ulazne fakture prodavnice Radnja Kod Brata (PIB 101234567), ukupno 2.",
        "",
        "Pekara Klasje d.o.o. – 12/2026 – 1.200,00 din",
        "Mlečni put d.o.o. – 13/2026 – 1.234,50 din",
        "",
        "Srdačan pozdrav",
      ].join("\n")
    );
  });

  it("marks a test mail", () => {
    expect(invoiceMail({ shopName: "R", pib: "101234567", invoices: two, todayIso: "2026-11-19", mock: true }).subject).toBe(
      "[PROBA] Prihvaćene fakture – R – 19.11.2026."
    );
  });

  it("numbers the mails when the invoices need more than one", () => {
    const mail = invoiceMail({ shopName: "R", pib: "101234567", invoices: [two[0]], todayIso: "2026-11-19", mock: false, part: { index: 1, count: 2 } });
    expect(mail.subject).toBe("Prihvaćene fakture – R – 19.11.2026. (1/2)");
    expect(mail.text).toContain("ukupno 1.");
  });
});

describe("attachmentNames", () => {
  it("names each PDF by supplier and number, and keeps repeated names apart", () => {
    const invoices = [invoice(1, { supplier: "A", number: "1" }), invoice(2, { supplier: "A", number: "1" }), invoice(3, { supplier: "A", number: "1" }), invoice(4, { supplier: "B", number: "1" })];
    expect(attachmentNames(invoices)).toEqual(["A – 1.pdf", "A – 1 (2).pdf", "A – 1 (3).pdf", "B – 1.pdf"]);
  });
});

describe("splitBySize", () => {
  it("fills each mail up to the limit, in order", () => {
    expect(splitBySize([10, 10, 10], 25)).toEqual([[0, 1], [2]]);
    expect(splitBySize([5, 5, 5], 25)).toEqual([[0, 1, 2]]);
    expect(splitBySize([], 25)).toEqual([]);
  });

  it("gives a file over the limit a mail of its own", () => {
    expect(splitBySize([30, 5], 25)).toEqual([[0], [1]]);
    expect(splitBySize([5, 30, 5], 25)).toEqual([[0], [1], [2]]);
  });

  it("allows 25 MB of attachments per mail", () => {
    expect(MAX_MAIL_BYTES).toBe(25 * 1024 * 1024);
  });
});
