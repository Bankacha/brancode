import { sameArticleCodes } from "./ean.js";

const UNIQUE_VIOLATION = "23505";

const run = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// Data access for a shared list type (Popis, Trebovanje): lists and their
// items in Supabase, with camelCase ↔ snake_case mapping from `config`.
// Everything throws on a failed request (usually no connection); callers
// show the message and offer to retry.
export const createListStore = (config, client) => {
  const { listTable, itemTable, parentKey, listColumns, itemColumns, addQuantityRpc, listFromRow, listToRow, itemFromRow, itemToRow } = config;
  const items = () => client.from(itemTable);

  const findItem = async (listId, code) => {
    const rows = await run(items().select(itemColumns).eq(parentKey, listId).in("barcode", sameArticleCodes(code)).limit(1));
    return rows?.[0] ? itemFromRow(rows[0]) : null;
  };

  return {
    list: async () => {
      const rows = await run(client.from(listTable).select(`${listColumns}, ${itemTable}(count)`).order("created_at", { ascending: false }));
      return rows.map((row) => ({ ...listFromRow(row), itemCount: row[itemTable]?.[0]?.count ?? 0 }));
    },
    get: async (id) => {
      const row = await run(client.from(listTable).select(listColumns).eq("id", id).maybeSingle());
      return row ? listFromRow(row) : null;
    },
    create: async (fields) => listFromRow(await run(client.from(listTable).insert(listToRow(fields)).select(listColumns).single())),
    update: async (id, fields) => {
      const row = await run(client.from(listTable).update(listToRow(fields)).eq("id", id).select(listColumns).maybeSingle());
      return row ? listFromRow(row) : null;
    },
    remove: async (id) => {
      await run(client.from(listTable).delete().eq("id", id));
    },

    items: async (listId) =>
      (await run(items().select(itemColumns).eq(parentKey, listId).order("created_at", { ascending: false }))).map(itemFromRow),
    findItem,
    // Another phone may have added the same code a moment ago: the unique
    // barcode index refuses the second insert, and the caller gets the item
    // that is already there instead of an error.
    addItem: async (listId, item) => {
      const { data, error } = await items().insert({ [parentKey]: listId, ...itemToRow(item) }).select(itemColumns).single();
      if (error?.code === UNIQUE_VIOLATION) return { duplicate: await findItem(listId, item.barcode) };
      if (error) throw error;
      return { item: itemFromRow(data) };
    },
    // Summed in the database, so two phones counting the same article both count.
    addQuantity: async (itemId, amount) => {
      const row = await run(client.rpc(addQuantityRpc, { item_id: itemId, amount }));
      return row ? itemFromRow(row) : null;
    },
    updateItem: async (itemId, fields) => {
      const row = await run(items().update(itemToRow(fields)).eq("id", itemId).select(itemColumns).maybeSingle());
      return row ? itemFromRow(row) : null;
    },
    removeItem: async (itemId) => {
      await run(items().delete().eq("id", itemId));
    },
    restoreItem: async (listId, item) =>
      itemFromRow(await run(items().insert({ id: item.id, [parentKey]: listId, ...itemToRow(item) }).select(itemColumns).single())),
  };
};
