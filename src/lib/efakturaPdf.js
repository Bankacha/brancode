import { PDFDocument } from "pdf-lib";

// Server only: the PDFs that go out by mail. The shop prints what arrives,
// so the accepted invoices travel as one file: open it, print once.

// Every page of every file, in the order given. A file pdf-lib can't read is
// left out and named in `failed` (its index), so the caller can attach it on
// its own instead of losing it; `bytes` is null when nothing could be read.
export const mergePdfs = async (files) => {
  const merged = await PDFDocument.create();
  const failed = [];
  for (const [index, file] of files.entries()) {
    try {
      const doc = await PDFDocument.load(file, { ignoreEncryption: true });
      for (const page of await merged.copyPages(doc, doc.getPageIndices())) merged.addPage(page);
    } catch {
      failed.push(index);
    }
  }
  return { bytes: failed.length === files.length ? null : await merged.save(), failed };
};
