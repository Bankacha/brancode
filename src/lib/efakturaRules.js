import { formatPrice } from "./format.js";
import { addDays, formatDate } from "./listFormat.js";
import { plural } from "./plural.js";

// What the e-Faktura screens and the server agree on about incoming SEF
// invoices: statuses, the 15-day response deadline, day groups, which
// accepted invoices still have to be sent, amounts and file names. Pure, used
// on both sides (spec docs/superpowers/specs/2026-11-17-brancode-e-faktura-design.md).

export const PENDING_STATUSES = ["New", "Seen", "ReNotified"];
export const WINDOW_DAYS = 60; // the list shows invoices received in the last 60 days
export const RESPONSE_DAYS = 15; // days to accept or reject (from expert sources; checked on real invoices)
export const URGENT_DAYS = 3; // the deadline is highlighted from here on

const LABELS = {
  New: "Nova",
  Seen: "Viđena",
  ReNotified: "Ponovo poslata",
  Approved: "Prihvaćena",
  Rejected: "Odbijena",
  Cancelled: "Otkazana",
  Storno: "Stornirana",
};

export const statusLabel = (status) => LABELS[status] ?? "Nepoznat status";

export const isPending = (invoice) => PENDING_STATUSES.includes(invoice.status);

const belgradeDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" });

// The calendar day in Belgrade of an ISO date-time; null without a usable one.
export const belgradeDateOf = (iso) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : belgradeDay.format(date);
};

const dayNumber = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

// Days left to answer an invoice that is waiting. A re-notified one has had
// its reminder (SEF's list doesn't say when), so it gets no count.
export const responseDeadline = (invoice, todayIso) => {
  if (!isPending(invoice)) return null;
  if (invoice.status === "ReNotified") return { kind: "reminder" };
  const received = belgradeDateOf(invoice.receivedAt);
  if (!received) return null;
  const days = RESPONSE_DAYS - (dayNumber(todayIso) - dayNumber(received));
  if (days < 0) return { kind: "overdue" };
  return { kind: "days", days, urgent: days <= URGENT_DAYS };
};

export const deadlineText = (deadline) => {
  if (deadline.kind === "reminder") return "Podsetnik stigao · odgovori odmah";
  if (deadline.kind === "overdue") return "Rok prošao";
  if (deadline.days === 0) return "Rok ističe danas";
  return `još ${deadline.days} ${plural(deadline.days, "dan", "dana", "dana")}`;
};

const dayTitle = (key, todayIso) => {
  if (key === todayIso) return "Danas";
  if (key === addDays(todayIso, -1)) return "Juče";
  return `${formatDate(key)}.`;
};

const NO_DATE = "";

// Invoices by the day they arrived, newest day first and newest first within
// a day; any without a date go last.
export const groupByDay = (invoices, todayIso) => {
  const byDay = new Map();
  for (const invoice of invoices) {
    const key = belgradeDateOf(invoice.receivedAt) ?? NO_DATE;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(invoice);
  }
  const newestFirst = (a, b) => String(b.receivedAt ?? "").localeCompare(String(a.receivedAt ?? ""));
  return [...byDay.keys()]
    .sort((a, b) => (a === NO_DATE ? 1 : b === NO_DATE ? -1 : b.localeCompare(a)))
    .map((key) => ({ key, title: key === NO_DATE ? "Bez datuma" : dayTitle(key, todayIso), invoices: byDay.get(key).sort(newestFirst) }));
};

// Where an accepted invoice stands on its way to the shop's mail: sent; or
// already accepted when e-Faktura was connected (printed and carried then);
// or waiting to be sent, however and wherever it was accepted.
export const sendState = (invoice, { baselineIds, lastSent }) => {
  if (invoice.status !== "Approved") return null;
  if (lastSent.has(invoice.id)) return "sent";
  if (baselineIds.has(invoice.id)) return "before";
  return "unsent";
};

export const tabInvoices = (invoices, tab) => {
  if (tab === "pending") return invoices.filter(isPending);
  if (tab === "accepted") return invoices.filter((invoice) => invoice.status === "Approved");
  return invoices;
};

export const formatAmount = (amount, currency) => `${formatPrice(amount)} ${!currency || currency === "RSD" ? "din" : currency}`;

export const invoicesTotal = (invoices) => Math.round(invoices.reduce((sum, invoice) => sum + invoice.amount * 100, 0)) / 100;

export const fakture = (n) => `${n} ${plural(n, "faktura", "fakture", "faktura")}`;
export const fakturu = (n) => `${n} ${plural(n, "fakturu", "fakture", "faktura")}`;

// "Dobavljač – broj.pdf", safe as a file name on Windows and phones; the
// same name for the mail attachment and the downloaded PDF.
export const pdfFilename = (invoice) => {
  const base = `${invoice.supplier ?? ""} – ${invoice.number ?? ""}`
    .replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
    .trim();
  return `${base}.pdf`;
};
