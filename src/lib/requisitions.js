import { supabase } from "../supabaseClient.js";
import { createListStore } from "./listStore.js";
import { byAdded } from "./pdfOrder.js";

// Trebovanje: what to order for a day. Items need only a name; barcode,
// price and quantity are optional (null). Never writes to `products`.
const numberOrNull = (value) => (value === null || value === undefined ? null : Number(value));
const defined = (row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));

export const createRequisitionStore = (client) =>
  createListStore(
    {
      listTable: "requisitions",
      itemTable: "requisition_items",
      parentKey: "requisition_id",
      listColumns: "id, title, date, created_at",
      itemColumns: "id, barcode, name, price, quantity, created_at",
      addQuantityRpc: "add_requisition_quantity",
      listFromRow: (row) => ({ id: row.id, title: row.title, date: row.date, createdAt: row.created_at }),
      listToRow: (fields) => defined({ title: fields.title, date: fields.date }),
      itemFromRow: (row) => ({
        id: row.id,
        barcode: row.barcode,
        name: row.name,
        price: numberOrNull(row.price),
        quantity: numberOrNull(row.quantity),
        createdAt: row.created_at,
      }),
      // null clears a field, undefined leaves it alone
      itemToRow: (fields) => defined({ barcode: fields.barcode, name: fields.name, price: fields.price, quantity: fields.quantity }),
    },
    client
  );

export const requisitionStore = createRequisitionStore(supabase);

const sameName = (a, b) => a.trim().toLocaleLowerCase("sr") === b.trim().toLocaleLowerCase("sr");

// "Prenesi stavke": copies items into another trebovanje. An article that is
// already there gets the quantity added instead of a second row, or is
// skipped when there is nothing to add: the same barcode, or for items
// without one the same name ("Hleb za sendviče"). A failure part way throws
// with `done` set.
export const transferItems = async (store, items, targetId) => {
  const result = { copied: 0, added: 0, skipped: 0 };
  const unnamed = items.some((item) => !item.barcode) ? (await store.items(targetId)).filter((t) => !t.barcode) : [];
  const addTo = async (existing, quantity) => {
    if (quantity) {
      await store.addQuantity(existing.id, quantity);
      result.added++;
    } else {
      result.skipped++;
    }
  };
  // oldest first, so the target lists them in the source's order
  for (const item of [...items].sort(byAdded)) {
    try {
      const existing = item.barcode
        ? await store.findItem(targetId, item.barcode)
        : unnamed.find((target) => sameName(target.name, item.name)) ?? null;
      if (existing) {
        await addTo(existing, item.quantity);
        continue;
      }
      const added = await store.addItem(targetId, { barcode: item.barcode, name: item.name, price: item.price, quantity: item.quantity });
      if (added.listGone) throw Object.assign(new Error("list-gone"), { listGone: true });
      if (added.duplicate) await addTo(added.duplicate, item.quantity);
      else {
        result.copied++;
        if (!item.barcode) unnamed.push({ id: added.item.id, name: item.name }); // two "Hleb" in one transfer are one
      }
    } catch (e) {
      e.done = result.copied + result.added + result.skipped;
      throw e;
    }
  }
  return result;
};
