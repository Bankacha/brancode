import { sameArticleCodes } from "./ean.js";

// Importing a promo leaflet: the leaflet and, for every article already in
// `products`, its promo price and the regular price to bring back after the
// promotion. The promo prices go into `products` now if the promotion has
// started; otherwise the morning check (promoCheck.js) writes them on its
// first day. Articles that aren't in `products` are never added.

// The leaflet a new import may be with corrected dates: an open one whose
// period overlaps the new one and that has the same name or at least
// SAME_SHARE of the new leaflet's articles in the database. An exact repeat
// (same name and dates) is just imported again and isn't asked about.
const SAME_SHARE = 0.8;
const sameName = (a, b) => a.trim().toLocaleLowerCase("sr") === b.trim().toLocaleLowerCase("sr");

export const findSameLeaflet = async (store, { name, dateFrom, dateTo, matches }) => {
  const candidates = (await store.openLeaflets()).filter(
    (l) => l.dateFrom <= dateTo && dateFrom <= l.dateTo && !(sameName(l.name, name) && l.dateFrom === dateFrom && l.dateTo === dateTo)
  );
  if (candidates.length === 0) return null;
  const barcodes = [...new Set(matches.filter((m) => m.existing).map((m) => m.existing.barcode))];
  const items = barcodes.length
    ? await store.leafletItems(
        candidates.map((l) => l.id),
        [...new Set(barcodes.flatMap((b) => sameArticleCodes(b)))]
      )
    : [];
  const share = (leaflet) => {
    if (sameName(leaflet.name, name)) return 1;
    if (barcodes.length === 0) return 0;
    const theirs = items.filter((i) => i.leafletId === leaflet.id).map((i) => i.barcode);
    return barcodes.filter((b) => sameArticleCodes(b).some((code) => theirs.includes(code))).length / barcodes.length;
  };
  const best = candidates.map((l) => ({ l, share: share(l) })).sort((a, b) => b.share - a.share)[0];
  return best.share >= SAME_SHARE ? best.l : null;
};

// replaceId: the leaflet found by findSameLeaflet, when the shop said it is
// the same one with corrected dates — it gets the new dates (and its
// reminders again for a new end) instead of a second record.
export const importLeaflet = async (store, { name, dateFrom, dateTo, matches, replaceId }, today, now = new Date()) => {
  let leaflet;
  if (replaceId) {
    const previous = (await store.openLeaflets()).find((l) => l.id === replaceId);
    const newEnd = previous?.dateTo !== dateTo;
    await store.markLeaflet(replaceId, { dateFrom, dateTo, ...(newEnd && { remindedTomorrowAt: null, remindedTodayAt: null }) });
    leaflet = { ...previous, id: replaceId, dateFrom, dateTo };
  } else {
    leaflet = await store.saveLeaflet({ name, dateFrom, dateTo });
  }

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
