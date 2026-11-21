import { PDFDocument } from "pdf-lib";
// Imported up front so pdf.js reads text in this thread (no worker file to
// find at run time) and Vercel packs it with the function.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Server only: the PDFs that go out by mail. The shop prints what arrives,
// so the accepted invoices travel as one file: open it, print once.

// SEF's extended PDF (seen 21.11.2026): the invoice pages open with SEF's
// header ("Generisao sistem eFaktura pod brojem: … | Identifikator: <uuid>"),
// then come the "structured format" pages nobody prints: the first titled
// "Strukturirani format elektronske fakture u skladu sa specifikacijom …",
// each with the same identifier in its footer. Compared without spaces and
// case, since text pulled out of a PDF breaks lines anywhere; SEF writes the
// footer's "еFaktura" with a Cyrillic е.
const compact = (text) => (text ?? "").replace(/\s+/g, "").toLowerCase();
const SPEC_TITLE = "strukturiraniformatelektronskefaktureuskladusaspecifikacijom";
const SEF_HEADER = /^generisaosistem[eе]faktura/;
const IDENTIFIER = /identifikator:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

// Indexes of the structured-format pages in one invoice's page texts. Only
// what is certain: the first page opens with SEF's header and carries the
// identifier; the format starts on a later page with its title and that
// identifier; after it, a page goes only if it carries the identifier and is
// not an invoice page. Anything else (unreadable text, a supplier's own
// attachment) stays: better a page too many than a missing part of an invoice.
export const specPages = (texts) => {
  const pages = texts.map(compact);
  if (!SEF_HEADER.test(pages[0] ?? "")) return [];
  const id = pages[0].match(IDENTIFIER)?.[1];
  if (!id) return [];
  const start = pages.findIndex((page, i) => i > 0 && page.startsWith(SPEC_TITLE) && page.includes(id));
  if (start < 0) return [];
  return pages.flatMap((page, i) => (i === start || (i > start && page.includes(id) && !SEF_HEADER.test(page)) ? [i] : []));
};

// Each page's text, or null when pdf.js can't read the file.
const pageTexts = async (file) => {
  // a copy: pdf.js may take over the buffer it is given
  const task = getDocument({ data: file.slice(), verbosity: 0 });
  try {
    const doc = await task.promise;
    const texts = [];
    for (let n = 1; n <= doc.numPages; n += 1) texts.push((await (await doc.getPage(n)).getTextContent()).items.map((item) => item.str ?? "").join(" "));
    return texts;
  } catch {
    return null;
  } finally {
    await task.destroy().catch(() => {});
  }
};

// Temporary (0.16.0), for the check on the shop's real invoices: each page's
// kind and which pages specPages would leave out, without any of the text.
export const describePages = async (file) => {
  const texts = await pageTexts(file);
  if (!texts) return { pages: null, dropped: [] };
  const pages = texts.map(compact);
  const id = pages[0]?.match(IDENTIFIER)?.[1];
  return {
    pages: pages.map((page) => ({ sef: SEF_HEADER.test(page), title: page.startsWith(SPEC_TITLE), id: Boolean(id) && page.includes(id) })),
    dropped: specPages(texts),
  };
};

// Every page of every file, in the order given, without SEF's
// structured-format pages. A file pdf-lib can't read is left out and named
// in `failed` (its index), so the caller can attach it on its own instead of
// losing it; `bytes` is null when nothing could be read.
export const mergePdfs = async (files) => {
  const merged = await PDFDocument.create();
  const failed = [];
  for (const [index, file] of files.entries()) {
    try {
      const doc = await PDFDocument.load(file, { ignoreEncryption: true });
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
