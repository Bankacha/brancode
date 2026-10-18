import { useRef, useState } from "react";
import { inventoryStore } from "./inventories.js";
import { lookupArticle } from "./products.js";
import { parsePrice, toPriceInput } from "./format.js";
import { parseQuantity } from "./listFormat.js";

const IDLE = { kind: "idle" };
const quantityInput = (n) => String(n).replace(".", ",");

// What happens after a code is scanned or typed on a popis, as one state:
// loading → new (fill in) | duplicate (already there: add or edit) → add |
// edit. Items found in `products` get their name and price from there,
// locked; nothing is ever written to `products`.
export const useInventoryItemFlow = (listId) => {
  const [state, setState] = useState(IDLE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const set = (next) => {
    stateRef.current = next;
    setState(next);
  };

  const start = async (code) => {
    set({ kind: "loading", code });
    try {
      const existing = await inventoryStore.findItem(listId, code);
      if (existing) {
        set({ kind: "duplicate", item: existing });
        return { ok: true };
      }
      const product = await lookupArticle(code);
      // typed 12 digits of an article stored under its full code: keep the full one
      const barcode = product?.barcode?.length === 13 && code.length === 12 ? product.barcode : code;
      set({
        kind: "new",
        barcode,
        name: product?.name ?? "",
        price: product ? toPriceInput(product.price) : "",
        quantity: "",
        locked: Boolean(product),
        errors: {},
      });
      return { ok: true };
    } catch (e) {
      set(IDLE);
      return { ok: false, reason: "network" };
    }
  };

  const edit = (item) =>
    set({ kind: "edit", item, name: item.name, price: toPriceInput(item.price), quantity: quantityInput(item.quantity), locked: item.inProducts, errors: {} });

  const chooseAdd = () => set({ kind: "add", item: stateRef.current.item, amount: "", errors: {} });
  const chooseEdit = () => edit(stateRef.current.item);
  const setField = (key, value) => set({ ...stateRef.current, [key]: value, errors: { ...stateRef.current.errors, [key]: undefined } });
  const cancel = () => set(IDLE);

  const validItem = (s) => {
    const name = s.name.trim();
    const price = parsePrice(s.price);
    const quantity = parseQuantity(s.quantity, { allowZero: true });
    const errors = {};
    if (!name) errors.name = "Upiši naziv.";
    if (price === null) errors.price = "Upiši cenu veću od nule.";
    if (quantity === null) errors.quantity = "Upiši količinu: 0 ili više, do 3 decimale.";
    return { name, price, quantity, errors };
  };

  const save = async () => {
    const s = stateRef.current;
    try {
      if (s.kind === "add") {
        const amount = parseQuantity(s.amount);
        if (amount === null) {
          set({ ...s, errors: { amount: "Upiši koliko dodaješ: više od 0, do 3 decimale." } });
          return { ok: false, reason: "invalid" };
        }
        const item = await inventoryStore.addQuantity(s.item.id, amount);
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
        const result = await inventoryStore.addItem(listId, { barcode: s.barcode, name, price, quantity, inProducts: s.locked });
        if (result.duplicate) {
          set({ kind: "duplicate", item: result.duplicate });
          return { ok: false, reason: "duplicate" };
        }
        set(IDLE);
        return { ok: true, action: "added", item: result.item };
      }
      const item = await inventoryStore.updateItem(s.item.id, { name, price, quantity });
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

  return { state, start, edit, chooseAdd, chooseEdit, setField, save, cancel };
};
