import { sameArticleCodes } from "./ean.js";
import { formatPrice } from "./format.js";
import { addDays, formatDate } from "./listFormat.js";

// The promo leaflets a trebovanje item is on, for buying in ahead: every
// leaflet running on the trebovanje's date, and every one starting within
// UPCOMING_DAYS after it (upcoming: "USKORO") — an old trebovanje shows what
// ran and what was coming then, not later months. Running ones first, then
// by start. Same article = any of its codes, one entry per leaflet. Only
// reads the leaflet tables; if they can't be read, the items have none.
const UPCOMING_DAYS = 14;

const entriesFor = (item, leaflets, promo, dateIso) => {
  if (!item.barcode) return [];
  const codes = sameArticleCodes(item.barcode);
  return leaflets
    .map((leaflet) => {
      const found = promo.find((p) => p.leafletId === leaflet.id && codes.includes(p.barcode));
      return found && { leafletId: leaflet.id, promoPrice: found.promoPrice, dateFrom: leaflet.dateFrom, dateTo: leaflet.dateTo, upcoming: leaflet.dateFrom > dateIso };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.upcoming) - Number(b.upcoming) || a.dateFrom.localeCompare(b.dateFrom));
};

export const withLeafletMarks = async (store, dateIso, items) => {
  const none = items.map((item) => ({ ...item, leaflets: [], onLeaflet: false }));
  const coded = items.filter((item) => item.barcode);
  if (coded.length === 0) return none;
  try {
    const leaflets = await store.leafletsBetween(dateIso, addDays(dateIso, UPCOMING_DAYS));
    if (leaflets.length === 0) return none;
    const promo = await store.leafletItems(
      leaflets.map((l) => l.id),
      [...new Set(coded.flatMap((item) => sameArticleCodes(item.barcode)))]
    );
    return items.map((item) => {
      const found = entriesFor(item, leaflets, promo, dateIso);
      return { ...item, leaflets: found, onLeaflet: found.length > 0 };
    });
  } catch (e) {
    console.error("leaflet marks failed", e);
    return none;
  }
};

const day = (iso) => formatDate(iso).slice(0, 6); // "31.10."

// "Liflet 99,99 do 31.10." / "Liflet 89,99 · USKORO od 01.11."
export const leafletBadgeText = ({ promoPrice, dateFrom, dateTo, upcoming }) =>
  upcoming ? `Liflet ${formatPrice(promoPrice)} · USKORO od ${day(dateFrom)}` : `Liflet ${formatPrice(promoPrice)} do ${day(dateTo)}`;

export const leafletDateText = ({ dateFrom, dateTo, upcoming }) => (upcoming ? `od ${day(dateFrom)} do ${day(dateTo)}` : `do ${day(dateTo)}`);
