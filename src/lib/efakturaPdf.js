import { PDFDocument } from "pdf-lib";

// Server only: the PDFs that go out by mail. The shop prints what arrives,
// so the accepted invoices travel as one file: open it, print once.

// SEF's extended PDF (seen 21.11.2026): the invoice pages open with SEF's
// header ("Generisao sistem eFaktura pod brojem: … | Identifikator: <uuid>"),
// then come the "structured format" pages nobody prints: the first titled
// "Strukturirani format elektronske fakture u skladu sa specifikacijom …",
// all of them lists of SEF's labelled fields ("šifra kategorije PDV:", "neto
// cena artikla:" …) with the same identifier in a footer that writes
// "еFaktura" with a Cyrillic е. Compared without spaces, case and accents,
// since text pulled out of a PDF breaks lines anywhere.
const compact = (text) =>
  (text ?? "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const SPEC_TITLE = "strukturiraniformatelektronskefaktureuskladusaspecifikacijom";
const SEF_HEADER = /^generisaosistem[eе]faktura/;
const SEF_FOOTER = /.generisaosistem[eе]?faktura/;
const IDENTIFIER = /identifikator:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;
const SPEC_LABELS = [
  "sifrakategorijepdv:",
  "stopapdv:",
  "identifikatorartiklakodprodavca:",
  "standardniidentifikatorartikla:",
  "netocenaartikla:",
  "nazivartikla:",
  "identifikatorstavke:",
  "fakturisanakolicina:",
  "netoiznos:",
  "umanjenjenacenuartikla:",
  "brutocenaartikla:",
];
const specLabels = (page) => SPEC_LABELS.filter((label) => page.includes(label)).length;
// The format's last page is often just SEF's payment QR code ("NBS IPS QR")
// over the footer, now and then with a field or two above it (20 of 100
// real invoices, 21.11.2026): short, and ending in "NBS IPS QR" right before
// the footer.
const isQrPage = (page) => {
  const at = page.search(/generisaosistem[eе]?faktura/);
  const body = at >= 0 ? page.slice(0, at) : page;
  return body.endsWith("nbsipsqr") && body.length <= 70;
};

// Indexes of the structured-format pages in one invoice's page texts. Only
// what is certain: the first page opens with SEF's header and carries the
// identifier; the format starts on a later page with its title and that
// identifier; it goes on only while each next page carries the identifier,
// is not an invoice page and holds at least two of SEF's field labels or is
// the QR-code page, and stops at the first page that doesn't. Anything else (unreadable text, a
// supplier's attachment, even one SEF stamped) stays: better a page too many
// than a missing part of an invoice.
export const specPages = (texts) => {
  const pages = texts.map(compact);
  if (!SEF_HEADER.test(pages[0] ?? "")) return [];
  const id = pages[0].match(IDENTIFIER)?.[1];
  if (!id) return [];
  const start = pages.findIndex((page, i) => i > 0 && page.startsWith(SPEC_TITLE) && page.includes(id));
  if (start < 0) return [];
  const dropped = [start];
  for (let i = start + 1; i < pages.length; i += 1) {
    const page = pages[i];
    if (!page.includes(id) || SEF_HEADER.test(page) || (specLabels(page) < 2 && !isQrPage(page))) break;
    dropped.push(i);
  }
  return dropped;
};

// pdf.js, loaded on first use: its worker is imported first so it reads text
// in this thread (no worker file to find at run time); both imports are
// literal so Vercel packs them. If it can't load, no text: every page stays,
// and nothing else in e-Faktura depends on it.
let pdfjs = null;
const loadPdfjs = () =>
  (pdfjs ??= import("pdfjs-dist/legacy/build/pdf.worker.mjs")
    .then(() => import("pdfjs-dist/legacy/build/pdf.mjs"))
    .catch((err) => {
      pdfjs = null;
      throw err;
    }));

// Each page's text, or null when pdf.js can't read the file.
const pageTexts = async (file) => {
  let task;
  try {
    // a copy: pdf.js may take over the buffer it is given
    task = (await loadPdfjs()).getDocument({ data: file.slice(), verbosity: 0 });
    const doc = await task.promise;
    const texts = [];
    for (let n = 1; n <= doc.numPages; n += 1) texts.push((await (await doc.getPage(n)).getTextContent()).items.map((item) => item.str ?? "").join(" "));
    return texts;
  } catch {
    return null;
  } finally {
    await task?.destroy().catch(() => {});
  }
};

// Temporary (0.16.0), for the check on the shop's real invoices: each page's
// kind and which pages specPages would leave out; text only from a kept page
// the rule can't place (neither an invoice page nor a dropped one), its start.
export const describePages = async (file) => {
  const encrypted = await PDFDocument.load(file).then(
    () => false,
    (err) => err?.name === "EncryptedPDFError"
  );
  const texts = await pageTexts(file);
  if (!texts) return { encrypted, pages: null, dropped: [] };
  const pages = texts.map(compact);
  const id = pages[0]?.match(IDENTIFIER)?.[1];
  const dropped = specPages(texts);
  return {
    encrypted,
    pages: pages.map((page, i) => {
      const kind = { sef: SEF_HEADER.test(page), title: page.startsWith(SPEC_TITLE), id: Boolean(id) && page.includes(id), labels: specLabels(page), footer: SEF_FOOTER.test(page) };
      // a kept page the rule can't place: its start, to see what it is
      if (kind.sef || dropped.includes(i)) return kind;
      return { ...kind, chars: page.length, head: texts[i].replace(/\s+/g, " ").trim().slice(0, 160) };
    }),
    dropped,
  };
};

// Every page of every file, in the order given, without SEF's
// structured-format pages. A file pdf-lib can't read is left out and named
// in `failed` (its index), so the caller can attach it on its own instead of
// losing it; `bytes` is null when nothing could be read. An encrypted file
// counts as unreadable: pdf-lib can't decrypt, and copied as it is its pages
// would print blank.
export const mergePdfs = async (files) => {
  const merged = await PDFDocument.create();
  const failed = [];
  for (const [index, file] of files.entries()) {
    try {
      const doc = await PDFDocument.load(file);
      const texts = await pageTexts(file);
      const drop = new Set(texts && texts.length === doc.getPageCount() ? specPages(texts) : []);
      const keep = doc.getPageIndices().filter((i) => !drop.has(i));
      for (const page of await merged.copyPages(doc, keep)) merged.addPage(page);
    } catch {
      failed.push(index);
    }
  }
  return { bytes: failed.length === files.length ? null : await merged.save(), failed };
};
