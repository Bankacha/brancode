import { supabase } from "./supabaseClient.js";
import { barcodeCandidates } from "./lib/products.js";

// Leaflet row: Šifra, EAN, Naziv, Finalna cena na lifletu, Marža %, … — the
// price is the first decimal number that is immediately followed by the Marža
// percentage, which keeps later columns and names like "2.8%T" out of it.
const LEAFLET_ROW = /^(\d+)\s+(\d{8,14})\s+(.+?)\s+(\d+[.,]\d{2})\s+\d+%/;
const ROW_Y_TOLERANCE = 3;

// The text of each line, top to bottom: items within ROW_Y_TOLERANCE of one
// another are one line, joined left to right.
export const linesFromTextItems = (items) => {
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

  return lines.map(({ items: lineItems }) =>
    lineItems
      .sort((a, b) => a.x - b.x)
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  );
};

export const rowsFromTextItems = (items) =>
  linesFromTextItems(items).flatMap((text) => {
    const match = LEAFLET_ROW.exec(text);
    if (!match) return [];
    return [{ ean: match[2], name: match[3].trim(), price: parseFloat(match[4].replace(",", ".")) }];
  });

// "Jutro Liflet Avg od 25.09.2026 do 31.10.2026" — the leaflet's one dated
// line on its first page: the name, then the promotion's first and last day.
const LEAFLET_PERIOD = /^(.*?)\s*\bod\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s+do\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\.?/i;

const isoDate = (day, month, year) => {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCDate() !== Number(day) || date.getUTCMonth() !== Number(month) - 1) return null; // 31.02. doesn't exist
  return date.toISOString().slice(0, 10);
};

export const leafletPeriodFromText = (text) => {
  const match = LEAFLET_PERIOD.exec(text.trim());
  if (!match) return null;
  const dateFrom = isoDate(match[2], match[3], match[4]);
  const dateTo = isoDate(match[5], match[6], match[7]);
  if (!dateFrom || !dateTo) return null;
  return { name: match[1].trim() || null, dateFrom, dateTo };
};

const userFacingError = (message) => Object.assign(new Error(message), { userFacing: true });

export const parseLeafletPdf = async (arrayBuffer, onProgress) => {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const doc = await loadingTask.promise;
  try {
    const byEan = new Map();
    let period = null; // read from the first page only
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      onProgress?.(pageNumber, doc.numPages);
      const page = await doc.getPage(pageNumber);
      const { items } = await page.getTextContent();
      if (pageNumber === 1) period = linesFromTextItems(items).map(leafletPeriodFromText).find(Boolean) ?? null;
      for (const row of rowsFromTextItems(items)) byEan.set(row.ean, row);
    }
    if (byEan.size === 0) {
      throw userFacingError("Ovaj PDF ne liči na akcijski liflet — nijedan artikal nije pronađen.");
    }
    return { rows: [...byEan.values()], period };
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
