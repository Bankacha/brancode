import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describePages, mergePdfs, specPages } from "./efakturaPdf.js";

// Page texts shaped like SEF's extended PDF (21.11.2026): the invoice pages
// open with SEF's header, the "structured format" pages follow, the first
// with its title, every one with the invoice's identifier in the footer.
const ID = "cbfd7c34-ed3a-43bc-ae99-e45c3ddb87d1";
const visual = (n) => `Generisao sistem eFaktura pod brojem:3412213429 | Identifikator:${ID.slice(0, 30)} ${ID.slice(30)} | datum i vreme generisanja: 21.11.2026 14:14:54 lokalno vreme (Beograd) Strana ${n} Šifra 3350820 Terea ( EAN: 8600115399314 ) 10 kom`;
const footer = `Generisao sistem еFaktura pod brojem:3412213429 | Identifikator:${ID} | datum i vreme generisanja:21.11.2026 14:14:54 lokalno vreme (Beograd) NELT CO. DOO`;
const specStart = `Strukturirani format elektronske fakture u skladu sa specifikacijom prilagođene primene standarda SRPS EN 16931-1:2019/A2:2020 Faktura broj dokumenta : 3412213429 ${footer}`;
const specMore = `identifikator artikla kod prodavca: 3350826 standardni identifikator artikla: 8600115399352 šifra kategorije PDV: S ${footer}`;

// A PDF whose pages have these widths, so the order shows after merging.
const pdfOf = async (...widths) => {
  const doc = await PDFDocument.create();
  for (const width of widths) doc.addPage([width, 200]);
  return doc.save();
};
const widths = async (bytes) => (await PDFDocument.load(bytes)).getPages().map((page) => page.getWidth());

describe("specPages", () => {
  it("finds SEF's structured-format pages after the invoice", () => {
    expect(specPages([visual(1), visual(2), specStart])).toEqual([2]);
    expect(specPages([visual(1), visual(2), specStart, specMore])).toEqual([2, 3]);
  });

  it("keeps everything when there is no structured format", () => {
    expect(specPages([visual(1), visual(2)])).toEqual([]);
    expect(specPages([visual(1)])).toEqual([]);
  });

  it("never drops the first page, nor a page of the invoice itself", () => {
    expect(specPages([specStart, specMore])).toEqual([]);
    expect(specPages([visual(1), specStart, visual(3)])).toEqual([1]);
  });

  it("keeps a page that doesn't carry this invoice's identifier", () => {
    // e.g. the supplier's own attachment after the structured format
    expect(specPages([visual(1), specStart, "Otpremnica br. 55 Kovilovo"])).toEqual([1]);
    const otherId = specStart.replaceAll(ID, "00000000-0000-0000-0000-000000000000");
    expect(specPages([visual(1), otherId])).toEqual([]);
  });

  it("drops nothing it can't recognise", () => {
    expect(specPages([`Faktura ${ID}`, specStart])).toEqual([]); // no SEF header on the first page
    expect(specPages([visual(1), null, specStart])).toEqual([2]);
    expect(specPages([])).toEqual([]);
  });
});

// A one-page-per-text PDF with real text, so pdf.js can read it back.
const textPdf = async (...texts) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const [i, text] of texts.entries()) {
    const page = doc.addPage([400 + i, 600]);
    const ascii = text.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
    ascii.match(/.{1,70}/g).forEach((line, k) => page.drawText(line, { x: 10, y: 580 - k * 12, size: 8, font }));
  }
  return doc.save();
};

describe("mergePdfs", () => {
  it("leaves SEF's structured-format pages out of the file to print", async () => {
    const { bytes, failed } = await mergePdfs([await textPdf(visual(1), visual(2), specStart, specMore), await textPdf(visual(1))]);
    expect(failed).toEqual([]);
    expect(await widths(bytes)).toEqual([400, 401, 400]);
  });

  it("puts every page of every PDF into one, in the order given", async () => {
    const { bytes, failed } = await mergePdfs([await pdfOf(101, 102), await pdfOf(201), await pdfOf(301, 302, 303)]);
    expect(failed).toEqual([]);
    expect(await widths(bytes)).toEqual([101, 102, 201, 301, 302, 303]);
  });

  it("leaves out what is not a readable PDF and says which", async () => {
    const { bytes, failed } = await mergePdfs([await pdfOf(101), new Uint8Array([1, 2, 3]), await pdfOf(301)]);
    expect(failed).toEqual([1]);
    expect(await widths(bytes)).toEqual([101, 301]);
  });

  it("gives no file when nothing could be merged", async () => {
    expect(await mergePdfs([new Uint8Array([1, 2, 3])])).toEqual({ bytes: null, failed: [0] });
  });
});

describe("describePages (temporary check on real invoices)", () => {
  it("tells each page's kind and what would be left out, without the text", async () => {
    const file = await textPdf(visual(1), visual(2), specStart, specMore);
    const described = await describePages(file);
    expect(described).toEqual({
      pages: [
        { sef: true, title: false, id: true },
        { sef: true, title: false, id: true },
        { sef: false, title: true, id: true },
        { sef: false, title: false, id: true },
      ],
      dropped: [2, 3],
    });
    expect(JSON.stringify(described)).not.toContain("3412213429");
  });

  it("says when the text can't be read", async () => {
    expect(await describePages(new Uint8Array([1, 2, 3]))).toEqual({ pages: null, dropped: [] });
  });
});
