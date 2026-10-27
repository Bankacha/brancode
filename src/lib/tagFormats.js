import { supabase } from "../supabaseClient.js";
import { barcodeCandidates } from "./products.js";

// Each article's remembered price-tag format for Mix printing
// (`products.tag_format`: "shelf" | "fridge" | null). Read for the list when
// Mix opens; written after a Mix export, and then only that column.

const BATCH = 100; // codes per `in` filter, so request URLs stay short

const chunks = (list) => Array.from({ length: Math.ceil(list.length / BATCH) }, (_, i) => list.slice(i * BATCH, (i + 1) * BATCH));

// List barcode → { dbBarcode, format } for the articles found in `products`,
// matched the way prices are (exact code first, then without its check digit).
export const readTagFormats = async (barcodes, client = supabase) => {
  const candidates = [...new Set(barcodes.flatMap(barcodeCandidates))];
  const byBarcode = new Map();
  for (const part of chunks(candidates)) {
    const { data, error } = await client.from("products").select("barcode, tag_format").in("barcode", part);
    if (error) throw error;
    for (const row of data) byBarcode.set(row.barcode, row);
  }
  const formats = new Map();
  for (const barcode of barcodes) {
    const row = barcodeCandidates(barcode).map((code) => byBarcode.get(code)).find(Boolean);
    if (row) formats.set(barcode, { dbBarcode: row.barcode, format: row.tag_format ?? null });
  }
  return formats;
};

export const saveTagFormats = async (rows, client = supabase) => {
  const byFormat = new Map();
  for (const { dbBarcode, format } of rows) byFormat.set(format, [...(byFormat.get(format) ?? []), dbBarcode]);
  for (const [format, barcodes] of byFormat) {
    for (const part of chunks(barcodes)) {
      const { error } = await client.from("products").update({ tag_format: format }).in("barcode", part);
      if (error) throw error;
    }
  }
};
