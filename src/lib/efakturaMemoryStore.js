// The e-Faktura store (efakturaStore.js) kept in memory: for tests and for
// `npm run dev` (scripts/efakturaDevApi.mjs), where there is no service-role
// key. Same contract; like the real table, events can only be added (the
// test ones also cleared).

const EMPTY_SETTINGS = {
  keyCiphertext: null,
  keyIv: null,
  keyTag: null,
  keyLast4: null,
  shopName: null,
  pib: null,
  sendTo: null,
  connectedAt: null,
  baselineIds: [],
  updatedBy: null,
};

const copy = (settings) => settings && { ...settings, baselineIds: [...settings.baselineIds] };

export const createMemoryEfakturaStore = ({ now = () => new Date() } = {}) => {
  const settings = new Map();
  let events = [];

  return {
    getSettings: async (mode) => copy(settings.get(mode) ?? null),

    saveSettings: async (mode, fields) => {
      const next = { ...EMPTY_SETTINGS, ...settings.get(mode), ...fields, mode, updatedAt: now().toISOString() };
      settings.set(mode, copy(next));
      return copy(next);
    },

    addEvent: async ({ mode, invoiceId, action, comment, recipient, userEmail }) => {
      events.push({ mode, invoiceId, action, comment: comment ?? null, recipient: recipient ?? null, userEmail: userEmail ?? null, createdAt: now().toISOString() });
    },

    eventsSince: async (mode, sinceIso) => {
      const since = Date.parse(sinceIso);
      return events.filter((e) => e.mode === mode && Date.parse(e.createdAt) >= since).map(({ mode: _, ...event }) => ({ ...event }));
    },

    deleteMockEvents: async () => {
      events = events.filter((e) => e.mode !== "mock");
    },
  };
};
