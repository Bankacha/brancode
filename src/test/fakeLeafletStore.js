// In-memory stand-in for createLeafletStore (lib/leafletStore.js), with the
// same methods and camelCase shapes. `db` is open for setting up and checking
// state; failNext(method) makes that method throw once, like a dropped
// connection.
const LEAFLET_DEFAULTS = { pricesAppliedAt: null, pricesRestoredAt: null, remindedTomorrowAt: null, remindedTodayAt: null };

export const fakeLeafletStore = ({ leaflets = [], items = [], products = [] } = {}) => {
  const db = {
    leaflets: leaflets.map((l) => ({ ...LEAFLET_DEFAULTS, ...l })),
    items: items.map((i) => ({ restoreResult: null, ...i })),
    products: products.map((p) => ({ ...p })),
  };
  const failing = new Map();
  let nextId = db.leaflets.length + 1;
  const guard = (method) => {
    if (!failing.has(method)) return;
    const error = failing.get(method);
    failing.delete(method);
    throw error;
  };
  const copy = (rows) => rows.map((row) => ({ ...row }));
  const item = (leafletId, barcode) => db.items.find((i) => i.leafletId === leafletId && i.barcode === barcode);

  return {
    db,
    failNext: (method, error = new Error(`${method} failed`)) => failing.set(method, error),

    async saveLeaflet({ name, dateFrom, dateTo }) {
      guard("saveLeaflet");
      let leaflet = db.leaflets.find((l) => l.name === name && l.dateFrom === dateFrom && l.dateTo === dateTo);
      if (!leaflet) {
        leaflet = { ...LEAFLET_DEFAULTS, id: `L${nextId++}`, name, dateFrom, dateTo };
        db.leaflets.push(leaflet);
      }
      return { ...leaflet };
    },
    async openLeaflets() {
      guard("openLeaflets");
      return copy(db.leaflets.filter((l) => !l.pricesRestoredAt));
    },
    async leafletsOn(dateIso) {
      guard("leafletsOn");
      return copy(db.leaflets.filter((l) => l.dateFrom <= dateIso && dateIso <= l.dateTo));
    },
    async leafletsBetween(fromIso, toIso) {
      guard("leafletsBetween");
      return copy(db.leaflets.filter((l) => l.dateFrom <= toIso && fromIso <= l.dateTo));
    },
    async leafletItems(leafletIds, barcodes) {
      guard("leafletItems");
      return copy(db.items.filter((i) => leafletIds.includes(i.leafletId) && (!barcodes || barcodes.includes(i.barcode))));
    },
    async saveItems(leafletId, items) {
      guard("saveItems");
      for (const { barcode, name, promoPrice, regularPrice } of items) {
        const existing = item(leafletId, barcode);
        if (existing) Object.assign(existing, { name, promoPrice, regularPrice });
        else db.items.push({ leafletId, barcode, name, promoPrice, regularPrice, restoreResult: null });
      }
    },
    async setItemResults(leafletId, results) {
      guard("setItemResults");
      for (const { barcode, restoreResult } of results) {
        const existing = item(leafletId, barcode);
        if (existing) existing.restoreResult = restoreResult;
      }
    },
    async markLeaflet(id, fields) {
      guard("markLeaflet");
      Object.assign(db.leaflets.find((l) => l.id === id), fields);
    },
    async products(barcodes) {
      guard("products");
      return copy(db.products.filter((p) => barcodes.includes(p.barcode)));
    },
    async setProductPrices(rows) {
      guard("setProductPrices");
      for (const { barcode, price } of rows) {
        const product = db.products.find((p) => p.barcode === barcode);
        if (product) product.price = price;
      }
    },
  };
};
