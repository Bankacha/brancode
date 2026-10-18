import { supabase } from "../supabaseClient.js";
import { createListStore } from "./listStore.js";

// Popis: stocktaking lists with a period, shared by everyone in the shop
// (tables in supabase/migrations/20261018_popis_trebovanje.sql). Never
// writes to `products`.
const defined = (row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));

export const createInventoryStore = (client) =>
  createListStore(
    {
      listTable: "inventories",
      itemTable: "inventory_items",
      parentKey: "inventory_id",
      listColumns: "id, title, date_from, date_to, created_at",
      itemColumns: "id, barcode, name, price, quantity, in_products, created_at",
      addQuantityRpc: "add_inventory_quantity",
      listFromRow: (row) => ({ id: row.id, title: row.title, dateFrom: row.date_from, dateTo: row.date_to, createdAt: row.created_at }),
      listToRow: (fields) => defined({ title: fields.title, date_from: fields.dateFrom, date_to: fields.dateTo }),
      itemFromRow: (row) => ({
        id: row.id,
        barcode: row.barcode,
        name: row.name,
        price: Number(row.price),
        quantity: Number(row.quantity),
        inProducts: row.in_products,
        createdAt: row.created_at,
      }),
      itemToRow: (fields) =>
        defined({ barcode: fields.barcode, name: fields.name, price: fields.price, quantity: fields.quantity, in_products: fields.inProducts }),
    },
    client
  );

export const inventoryStore = createInventoryStore(supabase);
