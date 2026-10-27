// Data access for promo leaflets (`promo_leaflets`, `promo_leaflet_items`)
// and the prices they write to `products`. Queries only, no rules: the
// import (leafletImport.js), the morning check (promoCheck.js) and the
// trebovanje mark (leafletMarks.js) decide. Works with any Supabase client:
// the signed-in user's on the phone, the service-role one on the server.
// Every method throws what Supabase reports.

const BATCH = 100; // barcodes per `in` filter, so request URLs stay short
const WRITE_BATCH = 500;
const PAGE = 1000; // PostgREST's default row limit

const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const money = (value) => (value === null || value === undefined ? null : Number(value));

const toLeaflet = (row) => ({
  id: row.id,
  name: row.name,
  dateFrom: row.date_from,
  dateTo: row.date_to,
  pricesAppliedAt: row.prices_applied_at,
  pricesRestoredAt: row.prices_restored_at,
  remindedTomorrowAt: row.reminded_tomorrow_at,
  remindedTodayAt: row.reminded_today_at,
});

const toItem = (row) => ({
  leafletId: row.leaflet_id,
  barcode: row.barcode,
  name: row.name,
  promoPrice: money(row.promo_price),
  regularPrice: money(row.regular_price),
  restoreResult: row.restore_result,
});

const LEAFLET_COLUMNS = {
  pricesAppliedAt: "prices_applied_at",
  pricesRestoredAt: "prices_restored_at",
  remindedTomorrowAt: "reminded_tomorrow_at",
  remindedTodayAt: "reminded_today_at",
};

export const createLeafletStore = (client) => {
  // Every row of a query, a page at a time.
  const all = async (query) => {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const page = check(await query().range(from, from + PAGE - 1));
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  };

  return {
    async saveLeaflet({ name, dateFrom, dateTo }) {
      const row = check(
        await client
          .from("promo_leaflets")
          .upsert({ name, date_from: dateFrom, date_to: dateTo, imported_at: new Date().toISOString() }, { onConflict: "name,date_from,date_to" })
          .select()
          .single()
      );
      return toLeaflet(row);
    },

    async openLeaflets() {
      return check(await client.from("promo_leaflets").select("*").is("prices_restored_at", null)).map(toLeaflet);
    },

    async leafletsOn(dateIso) {
      return check(await client.from("promo_leaflets").select("*").lte("date_from", dateIso).gte("date_to", dateIso)).map(toLeaflet);
    },

    async leafletItems(leafletIds, barcodes) {
      if (leafletIds.length === 0 || barcodes?.length === 0) return [];
      // Ordered, so the pages of a long result neither skip nor repeat rows.
      const base = () => client.from("promo_leaflet_items").select("*").in("leaflet_id", leafletIds).order("leaflet_id").order("barcode");
      const rows = [];
      for (const part of barcodes ? chunks(barcodes, BATCH) : [null]) rows.push(...(await all(() => (part ? base().in("barcode", part) : base()))));
      return rows.map(toItem);
    },

    async saveItems(leafletId, items) {
      const rows = items.map(({ barcode, name, promoPrice, regularPrice }) => ({ leaflet_id: leafletId, barcode, name, promo_price: promoPrice, regular_price: regularPrice }));
      for (const part of chunks(rows, WRITE_BATCH)) check(await client.from("promo_leaflet_items").upsert(part, { onConflict: "leaflet_id,barcode" }));
    },

    async setItemResults(leafletId, results) {
      const byResult = new Map();
      for (const { barcode, restoreResult } of results) byResult.set(restoreResult, [...(byResult.get(restoreResult) ?? []), barcode]);
      for (const [restoreResult, barcodes] of byResult) {
        for (const part of chunks(barcodes, BATCH)) {
          check(await client.from("promo_leaflet_items").update({ restore_result: restoreResult }).eq("leaflet_id", leafletId).in("barcode", part));
        }
      }
    },


    async markLeaflet(id, fields) {
      const update = Object.fromEntries(Object.entries(fields).map(([key, value]) => [LEAFLET_COLUMNS[key], value]));
      check(await client.from("promo_leaflets").update(update).eq("id", id));
    },

    async products(barcodes) {
      const rows = [];
      for (const part of chunks(barcodes, BATCH)) rows.push(...check(await client.from("products").select("barcode, name, price").in("barcode", part)));
      return rows.map((row) => ({ ...row, price: money(row.price) }));
    },

    // Only for rows just read from `products`: an upsert would add a missing one.
    async setProductPrices(rows) {
      for (const part of chunks(rows, WRITE_BATCH)) check(await client.from("products").upsert(part));
    },
  };
};
