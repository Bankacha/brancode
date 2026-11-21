import { SefError, normalizeInvoice } from "./sefClient.js";
import { isPending } from "./efakturaRules.js";
import { formatPrice } from "./format.js";
import { addDays, formatDate } from "./listFormat.js";

// The test SEF (SEF_ENV unset or "mock", and always under `npm run dev`):
// made-up incoming invoices in the shape of SEF's PurchaseInvoiceOverviewDto,
// computed from today's date, so they look fresh every day. Every day of the
// last 20 brings two invoices; an invoice's id, supplier, amount and fate
// depend only on the day it arrived, so it keeps them from one day to the
// next. What the app accepts or rejects comes back through `decisions` (read
// from the app's own history), so changes survive between server calls.
// Never calls SEF.

const SUPPLIERS = [
  { name: "Mlečni put d.o.o.", pib: "100000017", mb: "20000001" },
  { name: "Pekara Klasje d.o.o.", pib: "100000025", mb: "20000002" },
  { name: "Voćar Plus d.o.o.", pib: "100000033", mb: "20000003" },
  { name: "Napici Sever d.o.o.", pib: "100000041", mb: "20000004" },
  { name: "Higijena Max d.o.o.", pib: "100000058", mb: "20000005" },
  { name: "Konditor Sloga d.o.o.", pib: "100000066", mb: "20000006" },
  { name: "Mesara Dvor d.o.o.", pib: "100000074", mb: "20000007" },
  { name: "Trgovina Most d.o.o.", pib: "100000082", mb: "20000008" },
];
const DAYS = 20; // invoices arrived today and on the 19 days before
const PER_DAY = 2;

const dayNumber = (iso) => Date.parse(`${iso}T00:00:00Z`) / 86400000;
const isoOfDay = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const mod = (n, m) => ((n % m) + m) % m;

// A small integer hash, the same on every machine.
const hash = (n) => {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
};

// What happens to an invoice, and how many days after it arrived. The first
// of a day is accepted on SEF every third day; the second is rejected,
// accepted and then stornoed, accepted, or left waiting, in a six-day cycle.
const fate = (day, k) => {
  if (k === 0) return mod(day, 3) === 0 ? { status: "Approved", at: 4 } : null;
  return [{ status: "Rejected", at: 2 }, { status: "Storno", at: 3 }, { status: "Approved", at: 2 }, { status: "Approved", at: 2 }, { status: "Approved", at: 2 }, null][mod(day, 6)];
};

const statusAt = (age, end) => {
  if (end && age >= end.at) return end.status;
  if (age <= 1) return "New";
  if (age >= 16) return "ReNotified"; // SEF's reminder after the 15 days
  return "Seen";
};

const two = (n) => String(n).padStart(2, "0");

export const mockInvoiceDtos = (todayIso) => {
  const today = dayNumber(todayIso);
  const dtos = [];
  for (let age = 0; age < DAYS; age += 1) {
    const day = today - age;
    const iso = isoOfDay(day);
    for (let k = 0; k < PER_DAY; k += 1) {
      const h = hash(day * PER_DAY + k);
      const supplier = SUPPLIERS[mod(day * PER_DAY + k, SUPPLIERS.length)];
      const net = 50_000 + (h % 9_000_000); // para
      const vat = Math.round(net * 0.2);
      dtos.push({
        invoiceId: day * 10 + k + 1,
        globUniqId: `mock-${day}-${k}`,
        documentNumber: `${100 + (h % 900)}/${iso.slice(0, 4)}`,
        documentType: "Invoice",
        status: statusAt(age, fate(day, k)),
        supplierName: supplier.name,
        supplierRegistrationNumber: supplier.mb,
        supplierVatRegistrationNumber: supplier.pib,
        amount: (net + vat) / 100,
        sumWithoutVat: net / 100,
        vatAmount: vat / 100,
        currency: "RSD",
        sentDate: `${iso}T${two(6 + k * 3 + (h % 3))}:${two(h % 60)}:00Z`,
        dueDate: `${addDays(iso, 30)}T00:00:00`,
      });
    }
  }
  return dtos;
};

const DECIDED = { accepted: "Approved", rejected: "Rejected" };

export const createSefMock = ({ apiKey, todayIso, decisions }) => {
  const current = async () => {
    const decided = await decisions();
    return mockInvoiceDtos(todayIso).map((dto) => (decided.has(dto.invoiceId) ? { ...dto, status: DECIDED[decided.get(dto.invoiceId)] } : dto));
  };
  const find = async (invoiceId) => {
    const dto = (await current()).find((d) => d.invoiceId === invoiceId);
    if (!dto) throw new SefError("sef-error", 404, "Faktura ne postoji");
    return dto;
  };

  const mock = {
    checkKey: async () => {
      if (apiKey === "neispravan") throw new SefError("key-rejected", 401);
    },

    overview: async ({ dateFrom, dateTo }) =>
      (await current())
        .filter((dto) => {
          const at = Date.parse(dto.sentDate);
          return at >= dateFrom.getTime() && at <= dateTo.getTime();
        })
        .map(normalizeInvoice),

    acceptReject: async ({ invoiceId }) => {
      const dto = await find(invoiceId);
      return isPending(dto) ? { success: true, message: null } : { success: false, message: "Faktura nije na čekanju" };
    },

    invoiceStatus: async (invoiceId) => (await find(invoiceId)).status,

    pdf: async (invoiceId) => {
      const dto = await find(invoiceId);
      return mockPdf([
        "PROBNA FAKTURA - izmisljena, nije sa SEF-a",
        "",
        dto.supplierName,
        `PIB ${dto.supplierVatRegistrationNumber}`,
        `Broj fakture: ${dto.documentNumber}`,
        `Primljena: ${formatDate(dto.sentDate.slice(0, 10))}.`,
        `Valuta: ${formatDate(dto.dueDate.slice(0, 10))}.`,
        `Iznos bez PDV-a: ${formatPrice(dto.sumWithoutVat)} RSD`,
        `PDV: ${formatPrice(dto.vatAmount)} RSD`,
        `Ukupno: ${formatPrice(dto.amount)} RSD`,
      ]);
    },

    pdfMany: async (invoiceIds) => {
      const got = new Map();
      for (const invoiceId of invoiceIds) {
        try {
          got.set(invoiceId, await mock.pdf(invoiceId));
        } catch (err) {
          got.set(invoiceId, err);
        }
      }
      return got;
    },
  };
  return mock;
};

const ASCII = { č: "c", ć: "c", š: "s", ž: "z", đ: "dj", Č: "C", Ć: "C", Š: "S", Ž: "Z", Đ: "Dj", "–": "-", "—": "-" };

const pdfText = (line) =>
  [...line]
    .map((c) => ASCII[c] ?? (c.charCodeAt(0) < 128 ? c : "?"))
    .join("")
    .replace(/[\\()]/g, (c) => `\\${c}`);

// A minimal one-page PDF (Helvetica, ASCII text) for the test invoices.
export const mockPdf = (lines) => {
  const content = `BT /F1 13 Tf 50 790 Td 18 TL ${lines.map((line) => `(${pdfText(line)}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
};
