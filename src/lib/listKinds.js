import { inventoryStore } from "./inventories.js";
import { requisitionStore } from "./requisitions.js";

// What differs between the list types sharing the item flow, its sheet and
// the scan/keypad screens: where the data lives, what an item must have, and
// the words for it.
export const popisKind = {
  section: "popis",
  store: inventoryStore,
  rules: { priceRequired: true, quantityRequired: true, zeroQuantity: true, lockProductName: true },
  texts: {
    onList: "na popisu",
    duplicateTitle: "Artikal je već na popisu",
    priceLabel: "Cena",
    quantityLabel: "Količina na stanju",
    quantityError: "Upiši količinu: 0 ili više, do 3 decimale.",
    listGone: "Popis više ne postoji. Obrisan je na drugom telefonu.",
  },
};

export const trebovanjeKind = {
  section: "trebovanje",
  store: requisitionStore,
  // a scanned article may be renamed on a trebovanje (what to order, in the
  // shop's own words); its price stays as in `products`
  rules: { priceRequired: false, quantityRequired: false, zeroQuantity: false, lockProductName: false },
  texts: {
    onList: "na trebovanju",
    duplicateTitle: "Artikal je već na trebovanju",
    priceLabel: "Cena (nije obavezno)",
    quantityLabel: "Količina (nije obavezno)",
    quantityError: "Količina: više od 0, do 3 decimale, ili prazno.",
    listGone: "Trebovanje više ne postoji. Obrisano je na drugom telefonu.",
  },
};
