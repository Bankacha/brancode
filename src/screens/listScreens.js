import { formatPrice } from "../lib/format.js";
import { inventoryTitle, requisitionTitle } from "../lib/listFormat.js";
import { popisKind, trebovanjeKind } from "../lib/listKinds.js";
import { inventoryPdfDefinition, inventoryPdfFilename } from "../lib/listPdf.js";
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
  FormSheet: RequisitionFormSheet,
  pdf: null,
  texts: {
    fallbackTitle: "Trebovanje",
    gone: "Trebovanje više ne postoji.",
    notLoaded: "Nema veze. Trebovanje nije učitano.",
    notRenamed: "Nema veze. Trebovanje nije izmenjeno.",
    rename: "Izmeni naziv i datum",
    renameHeading: "Izmeni trebovanje",
  },
};
