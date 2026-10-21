import { sameArticleCodes } from "./ean.js";
import { samePrice } from "./format.js";

// "Liflet" on a trebovanje item: the article was on a promo leaflet on the
// trebovanje's date and the item's price is that leaflet's price (an item
// added before the promo price was written keeps its regular price and no
// mark). Same article = any of its codes, as for duplicates. Only reads the
// leaflet tables; if they can't be read, the trebovanje shows unmarked.
export const withLeafletMarks = async (store, dateIso, items) => {
  const unmarked = items.map((item) => ({ ...item, onLeaflet: false }));
  const priced = items.filter((item) => item.barcode && item.price !== null && item.price !== undefined);
  if (priced.length === 0) return unmarked;
  try {
    const leaflets = await store.leafletsOn(dateIso);
    if (leaflets.length === 0) return unmarked;
    const promo = await store.leafletItems(
      leaflets.map((l) => l.id),
      [...new Set(priced.flatMap((item) => sameArticleCodes(item.barcode)))]
    );
    const onLeaflet = (item) => {
      if (!item.barcode) return false;
      const codes = sameArticleCodes(item.barcode);
      return promo.some((p) => codes.includes(p.barcode) && samePrice(p.promoPrice, item.price));
    };
    return items.map((item) => ({ ...item, onLeaflet: onLeaflet(item) }));
  } catch (e) {
    console.error("leaflet marks failed", e);
    return unmarked;
  }
};
