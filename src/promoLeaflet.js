import { supabase } from "./supabaseClient.js";

// About half of the imported product list stores EAN-13 barcodes without their
// trailing check digit (12 digits), so a real 13-digit code won't string-match
// them. Candidates are tried in order: the exact code first, then that prefix.
export const barcodeCandidates = (code) => (/^\d{13}$/.test(code) ? [code, code.slice(0, 12)] : [code]);

// Leaflet row: Šifra, EAN, Naziv, Finalna cena na lifletu, Marža %, … — the
// price is the first decimal number that is immediately followed by the Marža
// percentage, which keeps later columns and names like "2.8%T" out of it.
const LEAFLET_ROW = /^(\d+)\s+(\d{8,14})\s+(.+?)\s+(\d+[.,]\d{2})\s+\d+%/;
const ROW_Y_TOLERANCE = 3;

export const rowsFromTextItems = (items) => {
  const sorted = items
    .filter((item) => item.str.trim())
    .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5] }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  for (const item of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - item.y) <= ROW_Y_TOLERANCE) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }

  return lines.flatMap(({ items: lineItems }) => {
    const text = lineItems
      .sort((a, b) => a.x - b.x)
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const match = LEAFLET_ROW.exec(text);
    if (!match) return [];
    return [{ ean: match[2], name: match[3].trim(), price: parseFloat(match[4].replace(",", ".")) }];
  });
};

const userFacingError = (message) => Object.assign(new Error(message), { userFacing: true });

export const parseLeafletPdf = async (arrayBuffer) => {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const doc = await loadingTask.promise;
  try {
    const byEan = new Map();
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const { items } = await page.getTextContent();
      for (const row of rowsFromTextItems(items)) byEan.set(row.ean, row);
    }
    if (byEan.size === 0) {
      throw userFacingError("Ovaj PDF ne liči na akcijski liflet — nijedan artikal nije pronađen.");
    }
    return [...byEan.values()];
  } finally {
    await loadingTask.destroy();
  }
};

// Batched so a long leaflet doesn't produce an over-long request URL.
const LOOKUP_BATCH = 100;

export const matchLeafletRows = async (rows) => {
  const candidates = [...new Set(rows.flatMap((row) => barcodeCandidates(row.ean)))];
  const byBarcode = new Map();
  for (let i = 0; i < candidates.length; i += LOOKUP_BATCH) {
    const { data, error } = await supabase
      .from("products")
      .select("barcode, name, price")
      .in("barcode", candidates.slice(i, i + LOOKUP_BATCH));
    if (error) throw error;
    for (const product of data) byBarcode.set(product.barcode, product);
  }
  return rows.map((row) => ({
    ...row,
    existing: barcodeCandidates(row.ean).map((code) => byBarcode.get(code)).find(Boolean) ?? null,
  }));
};

// Only products we already carry get the leaflet price — written to the row we
// actually matched, so legacy 12-digit rows are updated rather than duplicated.
// Leaflet articles that aren't in the database are never added to it.
export const saveLeafletPrices = async (matched) => {
  const byTarget = new Map();
  for (const { price, existing } of matched) {
    if (existing) byTarget.set(existing.barcode, { barcode: existing.barcode, name: existing.name, price });
  }
  if (byTarget.size === 0) return;
  const { error } = await supabase.from("products").upsert([...byTarget.values()]);
  if (error) throw error;
};
