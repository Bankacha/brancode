import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergePdfs } from "./efakturaPdf.js";

// A PDF whose pages have these widths, so the order shows after merging.
const pdfOf = async (...widths) => {
  const doc = await PDFDocument.create();
  for (const width of widths) doc.addPage([width, 200]);
  return doc.save();
};
const widths = async (bytes) => (await PDFDocument.load(bytes)).getPages().map((page) => page.getWidth());

describe("mergePdfs", () => {
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
