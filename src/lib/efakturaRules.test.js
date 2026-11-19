import { describe, it, expect } from "vitest";
import {
  PENDING_STATUSES,
  RESPONSE_DAYS,
  URGENT_DAYS,
  WINDOW_DAYS,
  belgradeDateOf,
  deadlineText,
  decisionNote,
  sentNote,
  fakture,
  fakturu,
  formatAmount,
  groupByDay,
  invoicesTotal,
  isPending,
  pdfFilename,
  responseDeadline,
  sendState,
  statusLabel,
  tabInvoices,
} from "./efakturaRules.js";

const TODAY = "2026-11-19";
// Noon in Belgrade, `days` before today.
const receivedDaysAgo = (days, hour = 11) => new Date(Date.UTC(2026, 10, 19 - days, hour)).toISOString();
const invoice = (id, fields = {}) => ({
  id,
  number: `F-${id}`,
  supplier: "Dobavljač",
  supplierPib: null,
  amount: 100,
  amountWithoutVat: null,
  vat: null,
  currency: "RSD",
  status: "New",
  receivedAt: receivedDaysAgo(0),
  dueDate: null,
  send: null,
  decision: null,
  ...fields,
});

describe("constants", () => {
  it("match the spec", () => {
    expect(PENDING_STATUSES).toEqual(["New", "Seen", "ReNotified"]);
    expect([WINDOW_DAYS, RESPONSE_DAYS, URGENT_DAYS]).toEqual([60, 15, 3]);
  });
});

describe("statusLabel", () => {
  it("names every SEF status in Serbian", () => {
    expect(["New", "Seen", "ReNotified", "Approved", "Rejected", "Cancelled", "Storno"].map(statusLabel)).toEqual([
      "Nova",
      "Viđena",
      "Ponovo poslata",
      "Prihvaćena",
      "Odbijena",
      "Otkazana",
      "Stornirana",
    ]);
  });

  it("has a fallback for an unknown status", () => {
    expect(statusLabel("Whatever")).toBe("Nepoznat status");
    expect(statusLabel(undefined)).toBe("Nepoznat status");
  });

  it("isPending covers New, Seen and ReNotified only", () => {
    expect(["New", "Seen", "ReNotified", "Approved", "Rejected"].map((status) => isPending({ status }))).toEqual([true, true, true, false, false]);
  });
});

describe("belgradeDateOf", () => {
  it("gives the Belgrade calendar day", () => {
    expect(belgradeDateOf("2026-11-18T23:30:00Z")).toBe("2026-11-19");
    expect(belgradeDateOf("2026-11-18T12:00:00Z")).toBe("2026-11-18");
  });

  it("gives null without a date", () => {
    expect(belgradeDateOf(null)).toBeNull();
    expect(belgradeDateOf("nije datum")).toBeNull();
  });
});

describe("responseDeadline", () => {
  it("counts 15 days from the day the invoice arrived", () => {
    expect(responseDeadline(invoice(1), TODAY)).toEqual({ kind: "days", days: 15, urgent: false });
    expect(responseDeadline(invoice(1, { receivedAt: receivedDaysAgo(12) }), TODAY)).toEqual({ kind: "days", days: 3, urgent: true });
  });

  it("says the deadline is today on day 15", () => {
    const deadline = responseDeadline(invoice(1, { receivedAt: receivedDaysAgo(15) }), TODAY);
    expect(deadline).toEqual({ kind: "days", days: 0, urgent: true });
    expect(deadlineText(deadline)).toBe("Rok ističe danas");
  });

  it("is overdue after that", () => {
    const deadline = responseDeadline(invoice(1, { receivedAt: receivedDaysAgo(16) }), TODAY);
    expect(deadline).toEqual({ kind: "overdue" });
    expect(deadlineText(deadline)).toBe("Rok prošao");
  });

  it("shows the reminder for a re-notified invoice", () => {
    const deadline = responseDeadline(invoice(1, { status: "ReNotified", receivedAt: receivedDaysAgo(17) }), TODAY);
    expect(deadline).toEqual({ kind: "reminder" });
    expect(deadlineText(deadline)).toBe("Podsetnik stigao · odgovori odmah");
  });

  it("has none for an invoice that is not waiting, or has no date", () => {
    expect(responseDeadline(invoice(1, { status: "Approved" }), TODAY)).toBeNull();
    expect(responseDeadline(invoice(1, { receivedAt: null }), TODAY)).toBeNull();
  });

  it("deadlineText counts days the Serbian way", () => {
    expect([1, 2, 5, 21].map((days) => deadlineText({ kind: "days", days, urgent: false }))).toEqual([
      "još 1 dan",
      "još 2 dana",
      "još 5 dana",
      "još 21 dan",
    ]);
  });
});

describe("groupByDay", () => {
  it("puts today and yesterday first, then older days, newest first within a day", () => {
    const groups = groupByDay(
      [
        invoice(1, { receivedAt: receivedDaysAgo(3) }),
        invoice(2, { receivedAt: receivedDaysAgo(0, 8) }),
        invoice(3, { receivedAt: receivedDaysAgo(1) }),
        invoice(4, { receivedAt: receivedDaysAgo(0, 14) }),
      ],
      TODAY
    );
    expect(groups.map((g) => g.title)).toEqual(["Danas", "Juče", "16.11.2026."]);
    expect(groups.map((g) => g.key)).toEqual(["2026-11-19", "2026-11-18", "2026-11-16"]);
    expect(groups[0].invoices.map((i) => i.id)).toEqual([4, 2]);
  });

  it("puts invoices without a date last", () => {
    const groups = groupByDay([invoice(1, { receivedAt: null }), invoice(2)], TODAY);
    expect(groups.map((g) => g.title)).toEqual(["Danas", "Bez datuma"]);
  });
});

describe("sendState", () => {
  const none = { baselineIds: new Set(), lastSent: new Map() };

  it("is unsent for an invoice accepted through the app", () => {
    expect(sendState(invoice(1, { status: "Approved" }), none)).toBe("unsent");
  });

  it("is unsent for an invoice that was waiting at connection and was accepted on SEF later", () => {
    // not in the baseline, which holds only what was already accepted then
    expect(sendState(invoice(2, { status: "Approved" }), { baselineIds: new Set([9]), lastSent: new Map() })).toBe("unsent");
  });

  it("is before for an invoice already accepted at connection", () => {
    expect(sendState(invoice(9, { status: "Approved" }), { baselineIds: new Set([9]), lastSent: new Map() })).toBe("before");
  });

  it("is sent once sent, even if it was in the baseline", () => {
    const lastSent = new Map([[9, { at: "2026-11-18T08:00:00Z", to: "radnja@primer.test" }]]);
    expect(sendState(invoice(9, { status: "Approved" }), { baselineIds: new Set([9]), lastSent })).toBe("sent");
  });

  it("is null for an invoice that is not accepted", () => {
    expect(sendState(invoice(1, { status: "Storno" }), none)).toBeNull();
    expect(sendState(invoice(1, { status: "Seen" }), none)).toBeNull();
  });
});

describe("tabInvoices", () => {
  const all = [
    invoice(1, { status: "New" }),
    invoice(2, { status: "Seen" }),
    invoice(3, { status: "ReNotified" }),
    invoice(4, { status: "Approved" }),
    invoice(5, { status: "Rejected" }),
    invoice(6, { status: "Storno" }),
  ];

  it("filters by tab", () => {
    expect(tabInvoices(all, "pending").map((i) => i.id)).toEqual([1, 2, 3]);
    expect(tabInvoices(all, "accepted").map((i) => i.id)).toEqual([4]);
    expect(tabInvoices(all, "all").map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("amounts and counts", () => {
  it("formatAmount shows dinars as din and other currencies by code", () => {
    expect(formatAmount(1234.5, "RSD")).toBe("1.234,50 din");
    expect(formatAmount(10, "EUR")).toBe("10,00 EUR");
  });

  it("invoicesTotal adds amounts to the para", () => {
    expect(invoicesTotal([invoice(1, { amount: 0.1 }), invoice(2, { amount: 0.2 })])).toBe(0.3);
    expect(invoicesTotal([])).toBe(0);
  });

  it("fakture and fakturu agree with the count", () => {
    expect([1, 2, 5, 21, 22].map(fakture)).toEqual(["1 faktura", "2 fakture", "5 faktura", "21 faktura", "22 fakture"]);
    expect([1, 2, 5, 21, 22].map(fakturu)).toEqual(["1 fakturu", "2 fakture", "5 faktura", "21 fakturu", "22 fakture"]);
  });
});

describe("notes from the history", () => {
  it("says when and where an invoice was sent, by the Belgrade day", () => {
    expect(sentNote({ state: "sent", lastSentAt: "2026-11-16T23:30:00Z", lastSentTo: "radnja@primer.test" })).toBe("Poslato 17.11. na radnja@primer.test");
  });

  it("says who decided and when, in Belgrade time", () => {
    expect(decisionNote({ action: "accepted", userEmail: "brat@primer.test", at: "2026-11-17T07:42:00Z", comment: null })).toBe("Prihvatio: brat@primer.test, 17.11. u 08:42");
    expect(decisionNote({ action: "rejected", userEmail: "brat@primer.test", at: "2026-07-01T07:05:00Z", comment: "Cena" })).toBe("Odbio: brat@primer.test, 01.07. u 09:05");
  });
});

describe("pdfFilename", () => {
  it("names the PDF by supplier and number, safe for a file name", () => {
    expect(pdfFilename(invoice(1, { supplier: "Mlečni put d.o.o.", number: "12/2026" }))).toBe("Mlečni put d.o.o. – 12-2026.pdf");
    expect(pdfFilename(invoice(1, { supplier: 'A:B*C?"<>|\\', number: "1\t2" }))).toBe("A-B-C------ – 1-2.pdf");
  });

  it("collapses spaces and caps the length", () => {
    expect(pdfFilename(invoice(1, { supplier: "  Pekara   Klasje  ", number: "7" }))).toBe("Pekara Klasje – 7.pdf");
    expect(pdfFilename(invoice(1, { supplier: "x".repeat(300), number: "1" })).length).toBe(124);
  });

  it("does not break without a supplier or number", () => {
    expect(pdfFilename(invoice(1, { supplier: "", number: "" }))).toBe("–.pdf");
    expect(pdfFilename(invoice(1, { supplier: null, number: undefined }))).toBe("–.pdf");
  });
});
