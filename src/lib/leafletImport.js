import { sameArticleCodes } from "./ean.js";

// Importing a promo leaflet: the leaflet and, for every article already in
// `products`, its promo price and the regular price to bring back after the
// promotion. The promo prices go into `products` now if the promotion has
// started; otherwise the morning check (promoCheck.js) writes them on its
// first day. Articles that aren't in `products` are never added.

export const importLeaflet = async (store, { name, dateFrom, dateTo, matches }, today, now = new Date()) => {
  const leaflet = await store.saveLeaflet({ name, dateFrom, dateTo });

  // One per database row: two leaflet codes can find the same row.
  const byBarcode = new Map();
  for (const { name: leafletName, price, existing } of matches) {
    // the database's name, or the leaflet's when the database has none
    if (existing) byBarcode.set(existing.barcode, { barcode: existing.barcode, name: existing.name || leafletName, promoPrice: price, dbPrice: existing.price ?? null });
  }
  const articles = [...byBarcode.values()];

  // The database may already hold a promo price: this same leaflet imported
  // again, or another running leaflet. Their remembered regular price wins.
  const open = await store.openLeaflets();
  // Same article = any of its codes: a scan may have moved the row from 12 to
  // 13 digits since the other leaflet was imported.
  const known = await store.leafletItems(
    open.map((l) => l.id),
    [...new Set(articles.flatMap((a) => sameArticleCodes(a.barcode)))]
  );
  const appliedElsewhere = new Set(open.filter((l) => l.id !== leaflet.id && l.pricesAppliedAt).map((l) => l.id));
  const regularPrice = ({ barcode, dbPrice }) => {
    const codes = sameArticleCodes(barcode);
    const same = known.find((i) => i.leafletId === leaflet.id && codes.includes(i.barcode));
    if (same) return same.regularPrice;
    const running = known.find((i) => appliedElsewhere.has(i.leafletId) && codes.includes(i.barcode));
    return running ? running.regularPrice : dbPrice;
  };

  await store.saveItems(
    leaflet.id,
    articles.map((a) => ({ barcode: a.barcode, name: a.name, promoPrice: a.promoPrice, regularPrice: regularPrice(a) }))
  );
  if (dateFrom > today) return { applied: false };

  await store.setProductPrices(articles.map((a) => ({ barcode: a.barcode, name: a.name, price: a.promoPrice })));
  await store.markLeaflet(leaflet.id, { pricesAppliedAt: now.toISOString() });
  return { applied: true };
};
