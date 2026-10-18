import { supabase } from "../supabaseClient.js";
import { sameArticleCodes } from "./ean.js";

// About half of the imported product list stores EAN-13 barcodes without their
// trailing check digit (12 digits), so a real 13-digit code won't string-match
// them. Candidates are tried in order: the exact code first, then that prefix.
export const barcodeCandidates = (code) => (/^\d{13}$/.test(code) ? [code, code.slice(0, 12)] : [code]);

export const lookupProduct = async (barcode, client = supabase) => {
  for (const candidate of barcodeCandidates(barcode)) {
    const { data, error } = await client
      .from("products")
      .select("barcode, name, price")
      .eq("barcode", candidate)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
};

// For Popis and Trebovanje, which only read `products`: also finds the full
// 13-digit row when someone typed the 12 digits printed without the last one.
export const lookupArticle = async (code, client = supabase) => {
  for (const candidate of sameArticleCodes(code)) {
    const { data, error } = await client.from("products").select("barcode, name, price").eq("barcode", candidate).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
};

export const saveProduct = async (product, matchedBarcode, client = supabase) => {
  // Found via the 12-digit fallback: move that row to the full scanned code
  // instead of adding a second row for the same article next to it.
  if (matchedBarcode && matchedBarcode !== product.barcode) {
    const { data, error } = await client
      .from("products")
      .update(product)
      .eq("barcode", matchedBarcode)
      .select("barcode");
    if (error) throw error;
    if (data.length > 0) return; // 0 if the row is gone or the update was refused
  }
  const { error } = await client.from("products").upsert(product);
  if (error) throw error;
};
