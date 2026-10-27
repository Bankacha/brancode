import { supabase } from "../supabaseClient.js";
import { fullCodeOf, sameArticleCodes, withCheckDigitIfShort, withoutCheckDigit } from "./ean.js";

// The imported product list stores barcodes without their trailing check
// digit (an EAN-13 as 12 digits, an EAN-8 as 7, …), so a scanned code won't
// string-match them. Candidates are tried in order: the exact code first,
// then the code without its check digit — only when that last digit really
// is one, so a mistyped code isn't matched to another article — and last, a
// typed short code with its check digit added, for a row a scan has already
// moved to its full code.
export const barcodeCandidates = (code) => [...new Set([code, withoutCheckDigit(code), withCheckDigitIfShort(code)].filter(Boolean))];

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

// For Popis and Trebovanje, which only read `products`: tries every form of
// the same article (`sameArticleCodes`), so typed digits without the check
// digit (7, 11 or 12) also find the full code, and a scanned code its
// shortened row.
export const lookupArticle = async (code, client = supabase) => {
  for (const candidate of sameArticleCodes(code)) {
    const { data, error } = await client.from("products").select("barcode, name, price").eq("barcode", candidate).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
};

export const saveProduct = async (product, matchedBarcode, client = supabase) => {
  // A short code (typed, or an old list row) found under its full code is
  // saved onto that row: a row is never moved to a shorter code.
  if (matchedBarcode && fullCodeOf(product.barcode, matchedBarcode) !== product.barcode) product = { ...product, barcode: matchedBarcode };
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
