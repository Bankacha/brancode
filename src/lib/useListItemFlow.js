import { useRef, useState } from "react";
import { lookupArticle } from "./products.js";
import { fullCodeOf } from "./ean.js";
import { parsePrice, toPriceInput } from "./format.js";
import { parseQuantity } from "./listFormat.js";

const IDLE = { kind: "idle" };
const numberInput = (n) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

// What happens after a code is scanned or typed on a list (`kind` from
// listKinds.js), as one state: loading → new (fill in) | duplicate (already
// there: add or edit) → add | edit. Items found in `products` get their name
// and price from there, locked; nothing is ever written to `products`.
export const useListItemFlow = (listId, kind) => {
  const { store, rules, texts } = kind;
  const [state, setState] = useState(IDLE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const set = (next) => {
    stateRef.current = next;
    setState(next);
  };
  // Every start or cancel bumps this; a lookup that comes back for an older
  // code (cancelled, or another code scanned since) is dropped.
  const request = useRef(0);

  const start = async (code) => {
    const id = ++request.current;
    const current = () => id === request.current;
    set({ kind: "loading", code });
    try {
      const existing = await store.findItem(listId, code);
      if (!current()) return { ok: true };
      if (existing) {
        set({ kind: "duplicate", item: existing });
        return { ok: true };
      }
      const product = await lookupArticle(code);
      if (!current()) return { ok: true };
      // typed digits of an article stored under its full code: keep the full one
      const barcode = fullCodeOf(code, product?.barcode);
      const hasPrice = product?.price !== null && product?.price !== undefined;
      set({
        kind: "new",
        barcode,
        name: product?.name ?? "",
        price: hasPrice ? toPriceInput(product.price) : "",
        quantity: "",
        // what the database has is locked; a missing name or price is typed
        lockName: rules.lockProductName && Boolean(product?.name),
        lockPrice: hasPrice,
        inProducts: Boolean(product),
        errors: {},
      });
      return { ok: true };
    } catch (e) {
      if (!current()) return { ok: true };
      set(IDLE);
      return { ok: false, reason: "network" };
    }
  };

  // Trebovanje only: an item that is just a name ("hleb za sendviče").
  const startWithoutBarcode = () => {
    request.current++;
    set({ kind: "new", barcode: null, name: "", price: "", quantity: "", lockName: false, lockPrice: false, inProducts: false, errors: {} });
  };

  const editState = (item, inProducts) => ({
    kind: "edit",
    item,
    name: item.name,
    price: item.price === null ? "" : toPriceInput(item.price),
    quantity: numberInput(item.quantity),
    lockName: rules.lockProductName && inProducts,
    lockPrice: inProducts && item.price !== null,
    inProducts,
    errors: {},
  });

  // A popis item knows whether it came from `products`; a trebovanje item
  // doesn't store it, so its barcode is looked up again — name and price stay
  // locked on edit as they were when it was added.
  const edit = (item) => {
    if (item.inProducts !== undefined || !item.barcode) {
      request.current++;
      set(editState(item, Boolean(item.inProducts)));
      return { ok: true };
    }
    const id = ++request.current;
    set({ kind: "loading", code: item.barcode });
    return lookupArticle(item.barcode).then(
      (product) => {
        if (id === request.current) set(editState(item, Boolean(product)));
        return { ok: true };
      },
      () => {
        if (id !== request.current) return { ok: true };
        set(IDLE);
        return { ok: false, reason: "network" };
      }
    );
  };

  const chooseAdd = () => set({ kind: "add", item: stateRef.current.item, amount: "", errors: {} });
  const chooseEdit = () => edit(stateRef.current.item);
  const setField = (key, value) => set({ ...stateRef.current, [key]: value, errors: { ...stateRef.current.errors, [key]: undefined } });
  const cancel = () => {
    request.current++;
    set(IDLE);
  };

  // Empty optional fields are saved as null; anything typed must be valid.
  const validItem = (s) => {
    const name = s.name.trim();
    const priceText = s.price.trim();
    const quantityText = s.quantity.trim();
    const price = priceText ? parsePrice(priceText) : null;
    const quantity = quantityText ? parseQuantity(quantityText, { allowZero: rules.zeroQuantity }) : null;
    const errors = {};
    if (!name) errors.name = "Upiši naziv.";
    if ((priceText || rules.priceRequired) && price === null) errors.price = "Upiši cenu veću od nule.";
    if ((quantityText || rules.quantityRequired) && quantity === null) errors.quantity = texts.quantityError;
    return { name, price, quantity, errors };
  };

  const save = async () => {
    const s = stateRef.current;
    if (s.kind !== "new" && s.kind !== "edit" && s.kind !== "add") return { ok: false, reason: "cancelled" };
    try {
      if (s.kind === "add") {
        const amount = parseQuantity(s.amount);
        if (amount === null) {
          set({ ...s, errors: { amount: "Upiši koliko dodaješ: više od 0, do 3 decimale." } });
          return { ok: false, reason: "invalid" };
        }
        const item = await store.addQuantity(s.item.id, amount);
        if (!item) return gone();
        set(IDLE);
        return { ok: true, action: "added-quantity", item, amount };
      }

      const { name, price, quantity, errors } = validItem(s);
      if (Object.keys(errors).length) {
        set({ ...s, errors });
        return { ok: false, reason: "invalid" };
      }
      if (s.kind === "new") {
        const result = await store.addItem(listId, { barcode: s.barcode, name, price, quantity, inProducts: s.inProducts });
        if (result.listGone) {
          set(IDLE);
          return { ok: false, reason: "list-gone" };
        }
        if (result.duplicate) {
          set({ kind: "duplicate", item: result.duplicate });
          return { ok: false, reason: "duplicate" };
        }
        set(IDLE);
        return { ok: true, action: "added", item: result.item };
      }
      const item = await store.updateItem(s.item.id, { name, price, quantity });
      if (!item) return gone();
      set(IDLE);
      return { ok: true, action: "updated", item };
    } catch (e) {
      return { ok: false, reason: "network" };
    }
  };

  // Deleted on another phone in the meantime.
  const gone = () => {
    set(IDLE);
    return { ok: false, reason: "gone" };
  };

  return { state, start, startWithoutBarcode, edit, chooseAdd, chooseEdit, setField, save, cancel };
};
