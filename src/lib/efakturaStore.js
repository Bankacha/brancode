// Server only: e-Faktura's own tables (supabase/migrations/20261119_efaktura.sql),
// reached with the service-role client; no app user can read them.
//   efaktura_settings — one row per mode (mock / demo / production): the sealed
//     SEF key, shop name, PIB, the connection day and what was already accepted then;
//   efaktura_events — the permanent history of what the app accepted, rejected
//     and sent, with the invoice as it was. Rows are only ever added.
// createMemoryEfakturaStore (efakturaMemoryStore.js) keeps the same contract
// for tests and `npm run dev`.

const SETTINGS_COLUMNS = {
  keyCiphertext: "key_ciphertext",
  keyIv: "key_iv",
  keyTag: "key_tag",
  keyLast4: "key_last4",
  shopName: "shop_name",
  pib: "pib",
  sendTo: "send_to",
  connectedAt: "connected_at",
  baselineIds: "baseline_ids",
  updatedBy: "updated_by",
};

const settingsOf = (row) =>
  row && {
    mode: row.mode,
    keyCiphertext: row.key_ciphertext,
    keyIv: row.key_iv,
    keyTag: row.key_tag,
    keyLast4: row.key_last4,
    shopName: row.shop_name,
    pib: row.pib,
    sendTo: row.send_to,
    connectedAt: row.connected_at,
    baselineIds: (row.baseline_ids ?? []).map(Number),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };

// The history row for one action, with the invoice as it was then.
export const eventRow = ({ mode, invoiceId, action, comment, recipient, userId, userEmail, snapshot }) => ({
  mode,
  invoice_id: invoiceId,
  action,
  comment: comment ?? null,
  recipient: recipient ?? null,
  user_id: userId ?? null,
  user_email: userEmail ?? null,
  supplier: snapshot.supplier,
  supplier_pib: snapshot.supplierPib,
  invoice_number: snapshot.number,
  received_at: snapshot.receivedAt,
  due_date: snapshot.dueDate,
  amount: snapshot.amount,
  amount_without_vat: snapshot.amountWithoutVat,
  vat: snapshot.vat,
  currency: snapshot.currency,
  sef_status: snapshot.status,
});

const eventOf = (row) => ({
  invoiceId: Number(row.invoice_id),
  action: row.action,
  comment: row.comment,
  recipient: row.recipient,
  userEmail: row.user_email,
  createdAt: row.created_at,
});

const PAGE = 1000; // PostgREST's default row limit

const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export const createEfakturaStore = (client, { now = () => new Date() } = {}) => ({
  getSettings: async (mode) => settingsOf(check(await client.from("efaktura_settings").select("*").eq("mode", mode).maybeSingle())),

  saveSettings: async (mode, fields) => {
    const row = { mode };
    for (const [field, column] of Object.entries(SETTINGS_COLUMNS)) if (field in fields) row[column] = fields[field];
    row.updated_at = now().toISOString();
    return settingsOf(check(await client.from("efaktura_settings").upsert(row, { onConflict: "mode" }).select("*").single()));
  },

  addEvent: async (event) => {
    check(await client.from("efaktura_events").insert(eventRow(event)));
  },

  // Every page: a missed "sent" row would offer an invoice for sending again.
  eventsSince: async (mode, sinceIso) => {
    const events = [];
    for (let from = 0; ; from += PAGE) {
      const rows = check(
        await client
          .from("efaktura_events")
          .select("invoice_id, action, comment, recipient, user_email, created_at")
          .eq("mode", mode)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1)
      );
      events.push(...rows.map(eventOf));
      if (rows.length < PAGE) return events;
    }
  },

  deleteMockEvents: async () => {
    check(await client.from("efaktura_events").delete().eq("mode", "mock"));
  },
});
