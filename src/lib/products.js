import { supabase } from "../supabaseClient.js";
import { sameArticleCodes, withoutCheckDigit } from "./ean.js";

// The imported product list stores barcodes without their trailing check
// digit (an EAN-13 as 12 digits, an EAN-8 as 7, …), so a scanned code won't
// string-match them. Candidates are tried in order: the exact code first,
// then the code without its check digit — only when that last digit really
// is one, so a mistyped code isn't matched to another article.
export const barcodeCandidates = (code) => [code, withoutCheckDigit(code)].filter(Boolean);

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
