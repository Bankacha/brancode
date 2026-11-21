import { formatAmount, pdfFilename } from "./efakturaRules.js";
import { formatDate } from "./listFormat.js";

// Server only: the mail that carries accepted invoices to the shop (later, to
// the accountant), all in one PDF to print at once. Resend takes up to 40 MB per mail
// with the attachments in base64, so 25 MB of PDFs leaves room for that.

export const MAX_MAIL_BYTES = 25 * 1024 * 1024;

export const invoiceMail = ({ shopName, pib, invoices, todayIso, mock, part = { index: 1, count: 1 } }) => ({
  subject: `${mock ? "[PROBA] " : ""}Prihvaćene fakture – ${shopName} – ${formatDate(todayIso)}.${part.count > 1 ? ` (${part.index}/${part.count})` : ""}`,
  text: [
    "Poštovani,",
    "",
    `u prilogu su prihvaćene ulazne fakture prodavnice ${shopName} (PIB ${pib}), ukupno ${invoices.length}, u jednom PDF-u, redom kojim su primljene:`,
    "",
    ...invoices.map((invoice) => `${invoice.supplier} – ${invoice.number} – ${formatAmount(invoice.amount, invoice.currency)}`),
    "",
    "Srdačan pozdrav",
  ].join("\n"),
});

// The one PDF with every invoice of a mail, to print at once.
export const mergedFilename = (todayIso, part = { index: 1, count: 1 }) =>
  `Prihvaćene fakture – ${formatDate(todayIso)}${part.count > 1 ? ` (${part.index} od ${part.count})` : ""}.pdf`;

// One file name per invoice; a repeated name gets " (2)", " (3)" so no
// attachment hides another.
export const attachmentNames = (invoices) => {
  const seen = new Map();
  return invoices.map((invoice) => {
    const name = pdfFilename(invoice);
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : `${name.slice(0, -4)} (${n}).pdf`;
  });
};

// Indexes of the files per mail, in order, each mail up to maxBytes; a file
// over the limit goes alone.
export const splitBySize = (sizes, maxBytes) => {
  const mails = [];
  let current = [];
  let total = 0;
  sizes.forEach((size, i) => {
    if (current.length > 0 && total + size > maxBytes) {
      mails.push(current);
      current = [];
      total = 0;
    }
    current.push(i);
    total += size;
  });
  if (current.length > 0) mails.push(current);
  return mails;
};
