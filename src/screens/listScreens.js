import { supabase } from "../supabaseClient.js";
import { formatPrice } from "../lib/format.js";
import { createLeafletStore } from "../lib/leafletStore.js";
import { withLeafletMarks } from "../lib/leafletMarks.js";
import { inventoryTitle, requisitionTitle } from "../lib/listFormat.js";
import { popisKind, trebovanjeKind } from "../lib/listKinds.js";
import { inventoryPdfDefinition, inventoryPdfFilename, requisitionPdfDefinition, requisitionPdfFilename } from "../lib/listPdf.js";
import { transferItems } from "../lib/requisitions.js";
import InventoryFormSheet from "../sheets/InventoryFormSheet.jsx";
import RequisitionFormSheet from "../sheets/RequisitionFormSheet.jsx";

// What a list screen (ListDetail) shows for each kind of list.
export const popisScreen = {
  kind: popisKind,
  title: inventoryTitle,
  detail: (item) => `${item.barcode} · ${formatPrice(item.price)}`,
  FormSheet: InventoryFormSheet,
  pdf: { definition: inventoryPdfDefinition, filename: inventoryPdfFilename, subject: (list) => `Popis – ${inventoryTitle(list)}` },
  texts: {
    fallbackTitle: "Popis",
    gone: "Popis više ne postoji.",
    notLoaded: "Nema veze. Popis nije učitan.",
    notRenamed: "Nema veze. Popis nije izmenjen.",
    rename: "Izmeni naziv i period",
    renameHeading: "Izmeni popis",
  },
};

export const trebovanjeScreen = {
  kind: trebovanjeKind,
  title: requisitionTitle,
  // only what the item has: an item can be just a name
  detail: (item) => [item.barcode, item.price === null ? null : formatPrice(item.price)].filter(Boolean).join(" · ") || null,
  // a price that is a promo leaflet's on the trebovanje's date (screen and PDF)
  decorate: (list, items) => withLeafletMarks(createLeafletStore(supabase), list.date, items),
  badge: (item) => (item.onLeaflet ? "Liflet" : null),
  FormSheet: RequisitionFormSheet,
  pdf: { definition: requisitionPdfDefinition, filename: requisitionPdfFilename, subject: (list) => `Trebovanje – ${requisitionTitle(list)}` },
  transfer: transferItems, // "Prenesi stavke" into another trebovanje
  texts: {
    fallbackTitle: "Trebovanje",
    gone: "Trebovanje više ne postoji.",
    notLoaded: "Nema veze. Trebovanje nije učitano.",
    notRenamed: "Nema veze. Trebovanje nije izmenjeno.",
    rename: "Izmeni naziv i datum",
    renameHeading: "Izmeni trebovanje",
  },
};
