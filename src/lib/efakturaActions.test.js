import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { latestDecisions, runEfakturaAction } from "./efakturaActions.js";
import { createMemoryEfakturaStore } from "./efakturaMemoryStore.js";
import { createSefMock, mockInvoiceDtos } from "./sefMock.js";
import { SefError } from "./sefClient.js";
import { MAX_MAIL_BYTES } from "./efakturaMail.js";
import { PDFDocument } from "pdf-lib";

const NOW = new Date("2026-11-19T09:00:00Z");
const TODAY = "2026-11-19";
const SECRET = randomBytes(32).toString("base64");
const KEY = "TAJNI-kljuc-1234";

const inv = (id, status = "New", fields = {}) => ({
  id,
  number: `${id}/2026`,
  supplier: `Dobavljač ${id}`,
  supplierPib: "100000017",
  amount: 1200,
  amountWithoutVat: 1000,
  vat: 200,
  currency: "RSD",
  status,
  receivedAt: "2026-11-18T08:00:00Z",
  dueDate: "2026-12-18",
  send: null,
  decision: null,
  ...fields,
});

// A hand-made SEF whose answers each test sets.
const fakeSef = (invoices, overrides = {}) => {
  const calls = [];
  const api = {
    checkKey: async () => {},
    overview: async () => invoices.map((i) => ({ ...i })),
    acceptReject: async (args) => {
      calls.push(["acceptReject", args]);
      return { success: true, message: null };
    },
    invoiceStatus: async (id) => {
      calls.push(["invoiceStatus", id]);
      return "Approved";
    },
    // a real one-page PDF, as wide as 100 + its id, so a merge shows the order
    pdf: async (id) => {
      calls.push(["pdf", id]);
      const doc = await PDFDocument.create();
      doc.addPage([100 + id, 200]);
      return doc.save();
    },
    // like SEF's client: each id gets its PDF or its error
    pdfMany: async (ids) => {
      const got = new Map();
      for (const id of ids) {
        try {
          got.set(id, await api.pdf(id));
        } catch (err) {
          if (err?.code === "key-rejected") throw err;
          got.set(id, err);
        }
      }
      return got;
    },
  };
  for (const [name, fn] of Object.entries(overrides)) api[name] = fn;
  return { calls, api };
};

const setup = ({ mode = "mock", acceptEnabled = true, sef, sendMail } = {}) => {
  const store = createMemoryEfakturaStore({ now: () => NOW });
  const recorded = [];
  const add = store.addEvent;
  store.addEvent = async (event) => {
    recorded.push(event);
    return add(event);
  };
  const mails = [];
  const ctx = {
    mode,
    acceptEnabled,
    secret: SECRET,
    store,
    sefFor: sef
      ? () => sef.api
      : (apiKey) => createSefMock({ apiKey, todayIso: TODAY, decisions: async () => latestDecisions(await store.eventsSince(mode, "2000-01-01")) }),
    sendMail:
      sendMail ??
      (async (mail) => {
        mails.push(mail);
      }),
    shopEmail: "radnja@primer.test",
    user: { id: "u1", email: "brat@primer.test" },
    now: () => NOW,
  };
  const run = (action, payload = {}) => runEfakturaAction(action, payload, ctx);
  return { ctx, store, recorded, mails, run };
};

const connect = (run, apiKey = KEY) => run("save-settings", { shopName: "Radnja Kod Brata", pib: "101234567", apiKey });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("status and settings", () => {
  it("reports an unconnected mode", async () => {
    const { run } = setup();
    expect(await run("status")).toEqual({
      status: 200,
      json: { ok: true, mode: "mock", acceptEnabled: true, connected: false, keyLast4: null, shopName: null, pib: null, shopEmail: "radnja@primer.test", sendTo: "radnja@primer.test", connectedAt: null },
    });
  });

  it("never returns the key or its sealed form", async () => {
    const { run, store } = setup();
    const saved = await connect(run);
    const status = await run("status");
    const sealed = await store.getSettings("mock");
    for (const res of [saved, status]) {
      const text = JSON.stringify(res);
      expect(text).not.toContain(KEY);
      expect(text).not.toContain(sealed.keyCiphertext);
      expect(text).not.toContain(sealed.keyTag);
    }
    expect(status.json).toMatchObject({ connected: true, keyLast4: "1234", shopName: "Radnja Kod Brata", pib: "101234567" });
  });

  it("refuses a bad shop name, a bad PIB and a missing key", async () => {
    const { run, store } = setup();
    expect((await run("save-settings", { shopName: "  ", pib: "101234567", apiKey: KEY })).json.error).toBe("invalid-shop-name");
    expect((await run("save-settings", { shopName: "x".repeat(101), pib: "101234567", apiKey: KEY })).json.error).toBe("invalid-shop-name");
    expect((await run("save-settings", { shopName: "Radnja", pib: "10123456", apiKey: KEY })).json.error).toBe("invalid-pib");
    expect((await run("save-settings", { shopName: "Radnja", pib: "10123456a", apiKey: KEY })).json.error).toBe("invalid-pib");
    const missing = await run("save-settings", { shopName: "Radnja", pib: "101234567", apiKey: "  " });
    expect(missing).toEqual({ status: 400, json: { ok: false, error: "missing-key" } });
    expect(await store.getSettings("mock")).toBeNull();
  });

  it("saves nothing when SEF refuses the key", async () => {
    const { run, store } = setup();
    expect(await connect(run, "neispravan")).toEqual({ status: 502, json: { ok: false, error: "key-rejected" } });
    expect(await store.getSettings("mock")).toBeNull();
  });

  it("remembers the connection day and what was already accepted then", async () => {
    const sef = fakeSef([inv(1, "New"), inv(2, "Approved"), inv(3, "Rejected"), inv(4, "Approved")]);
    const { run, store } = setup({ mode: "production", sef });
    await connect(run);
    const settings = await store.getSettings("production");
    expect(settings.connectedAt).toBe(NOW.toISOString());
    expect(settings.baselineIds).toEqual([2, 4]);
    expect(settings.updatedBy).toBe("brat@primer.test");
  });

  it("keeps the connection day and baseline when the key is replaced, once the app has been used", async () => {
    const invoices = [inv(2, "Approved"), inv(3, "New")];
    const sef = fakeSef(invoices);
    const { run, store, ctx } = setup({ mode: "production", sef });
    await connect(run);
    await run("accept", { invoiceIds: [3] });
    invoices.push(inv(5, "Approved"));
    ctx.now = () => new Date("2026-11-20T09:00:00Z");
    await connect(run, "NOVI-kljuc-9999");
    const settings = await store.getSettings("production");
    expect(settings).toMatchObject({ connectedAt: NOW.toISOString(), baselineIds: [2], keyLast4: "9999" });
  });

  it("takes the baseline again on the next save while nothing was done through the app", async () => {
    // 0.15.2 read SEF's capitalised fields as nothing and 0.15.4 saw only a
    // month: the shop connected with a short list of what was already accepted
    const invoices = [inv(1, "Approved")];
    const sef = fakeSef(invoices);
    const { run, store, ctx } = setup({ mode: "production", sef });
    await connect(run);
    invoices.push(inv(2, "Approved"), inv(3, "New"));
    ctx.now = () => new Date("2026-11-21T15:00:00Z");
    // "Proveri i sačuvaj" without typing the key again
    const saved = await run("save-settings", { shopName: "Radnja Kod Brata", pib: "101234567" });
    expect(saved.status).toBe(200);
    expect(await store.getSettings("production")).toMatchObject({ connectedAt: "2026-11-21T15:00:00.000Z", baselineIds: [1, 2], keyLast4: "1234" });
  });

  it("keeps an empty baseline once the app has history", async () => {
    const invoices = [inv(1, "New")];
    const sef = fakeSef(invoices);
    const { run, store, ctx } = setup({ mode: "production", sef });
    await connect(run);
    await run("accept", { invoiceIds: [1] });
    invoices.push(inv(2, "Approved"));
    await connect(run, "NOVI-kljuc-9999");
    expect(await store.getSettings("production")).toMatchObject({ connectedAt: NOW.toISOString(), baselineIds: [] });
    expect(ctx.mode).toBe("production");
  });

  it("tries a replacement key on the invoice list before saving it", async () => {
    const { run, store, ctx } = setup({ mode: "production", sef: fakeSef([]) });
    await connect(run);
    const before = await store.getSettings("production");
    ctx.sefFor = () =>
      fakeSef([], {
        overview: async () => {
          throw new SefError("key-rejected", 401);
        },
      }).api;
    expect(await connect(run, "POGRESAN-0000")).toEqual({ status: 502, json: { ok: false, error: "key-rejected" } });
    expect((await store.getSettings("production")).keyCiphertext).toBe(before.keyCiphertext);
  });

  it("changes the name and PIB without a new key once connected", async () => {
    const { run, store } = setup();
    await connect(run);
    const before = await store.getSettings("mock");
    const res = await run("save-settings", { shopName: "Nova Radnja", pib: "109876543" });
    expect(res.json).toMatchObject({ ok: true, shopName: "Nova Radnja", pib: "109876543", keyLast4: "1234" });
    expect((await store.getSettings("mock")).keyCiphertext).toBe(before.keyCiphertext);
  });

  it("keeps the modes apart", async () => {
    const real = setup({ mode: "production", sef: fakeSef([]) });
    await connect(real.run);
    const test = setup({ mode: "mock" });
    test.ctx.store = real.store;
    await test.run("save-settings", { shopName: "Proba", pib: "100000017", apiKey: "proba-0000" });
    await test.run("remove-key");
    expect(await real.store.getSettings("production")).toMatchObject({ shopName: "Radnja Kod Brata", keyLast4: "1234" });
  });

  it("removes the key but keeps the connection day", async () => {
    const { run, store } = setup();
    await connect(run);
    const res = await run("remove-key");
    expect(res.json).toMatchObject({ ok: true, connected: false, keyLast4: null });
    const settings = await store.getSettings("mock");
    expect(settings).toMatchObject({ keyCiphertext: null, keyIv: null, keyTag: null, keyLast4: null, connectedAt: NOW.toISOString() });
  });
});

describe("list", () => {
  it("needs a connection", async () => {
    const { run } = setup();
    expect(await run("list")).toEqual({ status: 409, json: { ok: false, error: "not-connected" } });
  });

  it("lists the test invoices, each with its send state and decision", async () => {
    const { run } = setup();
    await connect(run);
    const waiting = mockInvoiceDtos(TODAY).find((dto) => dto.status === "New");
    await run("accept", { invoiceIds: [waiting.invoiceId] });
    const { json } = await run("list");
    expect(json.ok).toBe(true);
    const accepted = json.invoices.find((i) => i.id === waiting.invoiceId);
    expect(accepted.status).toBe("Approved");
    expect(accepted.send).toEqual({ state: "unsent", lastSentAt: null, lastSentTo: null });
    expect(accepted.decision).toEqual({ action: "accepted", userEmail: "brat@primer.test", at: NOW.toISOString(), comment: null });
    // accepted on the "SEF" before connecting: printed and carried then
    const before = json.invoices.find((i) => i.status === "Approved" && i.id !== waiting.invoiceId);
    expect(before.send.state).toBe("before");
    expect(before.decision).toBeNull();
    expect(json.invoices.find((i) => i.status === "New").send).toBeNull();
  });

  it("counts every accepted invoice as handled before, until something is done through the app", async () => {
    // 0.15.2 and 0.15.4 connected the shop with a short list: without this,
    // 694 old invoices waited for sending, all ticked
    const invoices = [inv(1, "New")];
    const sef = fakeSef(invoices);
    const { run, store } = setup({ mode: "production", sef });
    await connect(run);
    invoices.push(inv(2, "Approved"));
    const { json } = await run("list");
    expect(json.invoices.find((i) => i.id === 2).send.state).toBe("before");
    expect((await store.getSettings("production")).baselineIds).toEqual([2]);
  });

  it("keeps the baseline once something was done through the app", async () => {
    const invoices = [inv(1, "New")];
    const sef = fakeSef(invoices);
    const { run, store } = setup({ mode: "production", sef });
    await connect(run);
    await run("accept", { invoiceIds: [1] });
    invoices.push(inv(3, "Approved"));
    const { json } = await run("list");
    expect(json.invoices.find((i) => i.id === 3).send.state).toBe("unsent");
    expect((await store.getSettings("production")).baselineIds).toEqual([]);
  });

  it("marks a sent invoice with when and where it went", async () => {
    const sef = fakeSef([inv(1, "Approved")]);
    const { run, ctx } = setup({ mode: "production", sef });
    ctx.sefFor = () => fakeSef([]).api;
    await connect(run); // nothing accepted at connection
    ctx.sefFor = () => sef.api;
    await run("send", { invoiceIds: [1] });
    const { json } = await run("list");
    expect(json.invoices[0].send).toEqual({ state: "sent", lastSentAt: NOW.toISOString(), lastSentTo: "radnja@primer.test" });
  });
});

describe("pdf", () => {
  it("gives the invoice's PDF", async () => {
    const { run } = setup();
    await connect(run);
    const id = mockInvoiceDtos(TODAY)[0].invoiceId;
    const res = await run("pdf", { invoiceId: id });
    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(res.pdf.slice(0, 8))).toBe("%PDF-1.4");
  });

  it("refuses a PDF too large to return", async () => {
    const sef = fakeSef([], { pdf: async () => new Uint8Array(4.5 * 1024 * 1024) });
    const { run } = setup({ mode: "production", sef });
    await connect(run);
    expect(await run("pdf", { invoiceId: 1 })).toEqual({ status: 413, json: { ok: false, error: "pdf-too-large" } });
  });

  it("checks the id", async () => {
    const { run } = setup();
    await connect(run);
    expect((await run("pdf", { invoiceId: "1" })).json.error).toBe("invalid-ids");
  });
});

describe("accept", () => {
  const connected = async (invoices, { sef: overrides, ...options } = {}) => {
    const sef = fakeSef(invoices, overrides);
    const env = setup({ mode: "production", ...options, sef });
    await connect(env.run);
    sef.calls.length = 0;
    return { ...env, sef };
  };

  it("is locked without SEF_ACCEPT and never reaches SEF", async () => {
    const { run, sef } = await connected([inv(1)], { acceptEnabled: false });
    expect(await run("accept", { invoiceIds: [1] })).toEqual({ status: 403, json: { ok: false, error: "accept-disabled" } });
    expect(await run("reject", { invoiceId: 1, comment: "Cena" })).toEqual({ status: 403, json: { ok: false, error: "accept-disabled" } });
    expect(sef.calls).toEqual([]);
  });

  it("checks the ids", async () => {
    const { run } = await connected([inv(1)]);
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    expect((await run("accept", { invoiceIds: ids })).json.error).toBe("too-many");
    expect((await run("accept", { invoiceIds: [1, 1] })).json.error).toBe("invalid-ids");
    expect((await run("accept", { invoiceIds: [0] })).json.error).toBe("invalid-ids");
    expect((await run("accept", { invoiceIds: [] })).json.error).toBe("invalid-ids");
    expect((await run("accept", { invoiceIds: "1" })).json.error).toBe("invalid-ids");
    expect((await run("accept", { invoiceIds: [1.5] })).json.error).toBe("invalid-ids");
  });

  it("accepts each invoice and records it with the invoice as it was", async () => {
    const { run, sef, recorded } = await connected([inv(1), inv(2, "Seen")]);
    const res = await run("accept", { invoiceIds: [1, 2] });
    expect(res).toEqual({ status: 200, json: { ok: true, results: [{ id: 1, outcome: "done" }, { id: 2, outcome: "done" }] } });
    expect(sef.calls).toEqual([
      ["acceptReject", { invoiceId: 1, accepted: true, comment: "" }],
      ["acceptReject", { invoiceId: 2, accepted: true, comment: "" }],
    ]);
    expect(recorded).toHaveLength(2);
    expect(recorded[0]).toMatchObject({ mode: "production", invoiceId: 1, action: "accepted", userId: "u1", userEmail: "brat@primer.test" });
    expect(recorded[0].snapshot).toMatchObject({ id: 1, dueDate: "2026-12-18", amount: 1200, amountWithoutVat: 1000, vat: 200, status: "Approved" });
  });

  it("reports an invoice accepted elsewhere as already", async () => {
    const { run, sef, recorded } = await connected([inv(1, "Approved")]);
    expect((await run("accept", { invoiceIds: [1] })).json.results).toEqual([{ id: 1, outcome: "already", status: "Approved" }]);
    expect(sef.calls).toEqual([]);
    expect(recorded).toEqual([]);
  });

  it("reports an invoice SEF no longer lists as not found", async () => {
    const { run } = await connected([]);
    expect((await run("accept", { invoiceIds: [9] })).json.results).toEqual([{ id: 9, outcome: "not-found" }]);
  });

  it("checks the status when SEF's answer is unclear, and counts it as done", async () => {
    const lost = async () => {
      throw new SefError("sef-unavailable");
    };
    const { run, recorded } = await connected([inv(1)], { sef: { acceptReject: lost, invoiceStatus: async () => "Approved" } });
    expect((await run("accept", { invoiceIds: [1] })).json.results).toEqual([{ id: 1, outcome: "done" }]);
    expect(recorded).toHaveLength(1);
  });

  it("does not take credit when SEF says no because someone else decided meanwhile", async () => {
    // accepted on SEF's website between the server's overview and this call
    const { run, recorded } = await connected([inv(1), inv(2)], {
      sef: { acceptReject: async () => ({ success: false, message: "Već obrađena" }), invoiceStatus: async (id) => (id === 1 ? "Approved" : "Rejected") },
    });
    expect((await run("accept", { invoiceIds: [1, 2] })).json.results).toEqual([
      { id: 1, outcome: "already", status: "Approved" },
      { id: 2, outcome: "already", status: "Rejected" },
    ]);
    expect(recorded).toEqual([]);
  });

  it("treats a refusal over HTTP like a clear no", async () => {
    const refused = async () => {
      throw new SefError("sef-error", 400, "Invoice already processed");
    };
    const { run, recorded } = await connected([inv(1)], { sef: { acceptReject: refused, invoiceStatus: async () => "Approved" } });
    expect((await run("accept", { invoiceIds: [1] })).json.results).toEqual([{ id: 1, outcome: "already", status: "Approved" }]);
    expect(recorded).toEqual([]);
  });

  it("fails an invoice that SEF refused and is still waiting", async () => {
    const { run, recorded } = await connected([inv(1)], { sef: { acceptReject: async () => ({ success: false, message: "Već obrađena" }), invoiceStatus: async () => "Seen" } });
    expect((await run("accept", { invoiceIds: [1] })).json.results).toEqual([{ id: 1, outcome: "failed", status: "Seen", message: "Već obrađena" }]);
    expect(recorded).toEqual([]);
  });

  it("leaves an invoice unconfirmed when SEF can't be asked either way", async () => {
    const down = async () => {
      throw new SefError("sef-unavailable", 503);
    };
    const { run, recorded } = await connected([inv(1)], { sef: { acceptReject: down, invoiceStatus: down } });
    expect((await run("accept", { invoiceIds: [1] })).json.results).toEqual([{ id: 1, outcome: "unconfirmed" }]);
    expect(recorded).toEqual([]);
  });

  it("stops when SEF refuses the key, keeping what was done", async () => {
    let n = 0;
    const acceptReject = async () => {
      n += 1;
      if (n === 2) throw new SefError("key-rejected", 401);
      return { success: true, message: null };
    };
    const { run, recorded } = await connected([inv(1), inv(2), inv(3)], { sef: { acceptReject } });
    expect(await run("accept", { invoiceIds: [1, 2, 3] })).toEqual({ status: 502, json: { ok: false, error: "key-rejected", results: [{ id: 1, outcome: "done" }] } });
    expect(recorded.map((e) => e.invoiceId)).toEqual([1]);
  });

  it("still reports done when SEF accepted but the history could not be written", async () => {
    const { run, store } = await connected([inv(1)]);
    store.addEvent = async () => {
      throw new Error("db down");
    };
    expect((await run("accept", { invoiceIds: [1] })).json.results).toEqual([{ id: 1, outcome: "done" }]);
  });
});

describe("reject", () => {
  it("needs a reason of 1 to 500 characters", async () => {
    const { run } = setup();
    await connect(run);
    for (const comment of ["", "   ", "x".repeat(501), undefined]) {
      expect((await run("reject", { invoiceId: 1, comment })).json.error).toBe("invalid-comment");
    }
  });

  it("sends the reason to SEF and records it", async () => {
    const sef = fakeSef([inv(1)], { invoiceStatus: async () => "Rejected" });
    const { run, recorded } = setup({ mode: "production", sef });
    await connect(run);
    const res = await run("reject", { invoiceId: 1, comment: "  Pogrešna cena  " });
    expect(res.json.results).toEqual([{ id: 1, outcome: "done" }]);
    expect(sef.calls).toContainEqual(["acceptReject", { invoiceId: 1, accepted: false, comment: "Pogrešna cena" }]);
    expect(recorded[0]).toMatchObject({ action: "rejected", comment: "Pogrešna cena" });
    expect(recorded[0].snapshot.status).toBe("Rejected");
  });
});

describe("send", () => {
  const ready = async (invoices, options = {}) => {
    const sef = fakeSef(invoices, options.sef);
    const env = setup({ mode: options.mode ?? "production", sef, sendMail: options.sendMail });
    env.ctx.sefFor = () => fakeSef([]).api;
    await connect(env.run);
    env.ctx.sefFor = () => sef.api;
    return { ...env, sef };
  };

  it("sends one mail with one PDF of every invoice, oldest first, to print at once, and records each", async () => {
    const { run, mails, recorded } = await ready([inv(1, "Approved", { receivedAt: "2026-11-18T08:00:00Z" }), inv(2, "Approved", { receivedAt: "2026-11-10T08:00:00Z" })]);
    const res = await run("send", { invoiceIds: [1, 2] });
    expect(res).toEqual({ status: 200, json: { ok: true, recipient: "radnja@primer.test", results: [{ id: 1, outcome: "sent" }, { id: 2, outcome: "sent" }] } });
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("radnja@primer.test");
    expect(mails[0].subject).toBe("Prihvaćene fakture – Radnja Kod Brata – 19.11.2026.");
    expect(mails[0].text).toContain("(PIB 101234567), ukupno 2, u jednom PDF-u");
    expect(mails[0].text.indexOf("Dobavljač 2")).toBeLessThan(mails[0].text.indexOf("Dobavljač 1"));
    expect(mails[0].attachments.map((a) => a.filename)).toEqual(["Prihvaćene fakture – 19.11.2026.pdf"]);
    const merged = await PDFDocument.load(mails[0].attachments[0].content);
    expect(merged.getPages().map((page) => page.getWidth())).toEqual([102, 101]);
    expect(recorded.map((e) => [e.invoiceId, e.action, e.recipient])).toEqual([
      [2, "sent", "radnja@primer.test"],
      [1, "sent", "radnja@primer.test"],
    ]);
  });

  it("marks a test mail", async () => {
    const { run, mails } = setup();
    await connect(run);
    const approved = (await run("list")).json.invoices.find((i) => i.status === "Approved");
    await run("send", { invoiceIds: [approved.id] });
    expect(mails[0].subject.startsWith("[PROBA] Prihvaćene fakture – Radnja Kod Brata")).toBe(true);
  });

  it("sends the others when one pdf fails and records only those", async () => {
    const pdf = async (id) => {
      if (id === 2) throw new SefError("sef-unavailable", 503);
      return new Uint8Array([1, 2, 3]);
    };
    const { run, mails, recorded } = await ready([inv(1, "Approved"), inv(2, "Approved"), inv(3, "Approved")], { sef: { pdf } });
    const res = await run("send", { invoiceIds: [1, 2, 3] });
    expect(res.json.results).toEqual([
      { id: 1, outcome: "sent" },
      { id: 2, outcome: "failed" },
      { id: 3, outcome: "sent" },
    ]);
    expect(mails[0].attachments).toHaveLength(2);
    expect(mails[0].text).not.toContain("Dobavljač 2");
    expect(recorded.map((e) => e.invoiceId)).toEqual([1, 3]);
  });

  it("attaches on its own a PDF that could not be merged", async () => {
    const pdf = async (id) => {
      if (id !== 2) {
        const doc = await PDFDocument.create();
        doc.addPage([100 + id, 200]);
        return doc.save();
      }
      return new Uint8Array([37, 80, 68, 70, 0]); // starts like a PDF, isn't one
    };
    const { run, mails } = await ready([inv(1, "Approved"), inv(2, "Approved"), inv(3, "Approved")], { sef: { pdf } });
    const res = await run("send", { invoiceIds: [1, 2, 3] });
    expect(res.json.results.map((r) => r.outcome)).toEqual(["sent", "sent", "sent"]);
    expect(mails[0].attachments.map((a) => a.filename)).toEqual(["Prihvaćene fakture – 19.11.2026.pdf", "Dobavljač 2 – 2-2026.pdf"]);
    expect((await PDFDocument.load(mails[0].attachments[0].content)).getPageCount()).toBe(2);
  });

  it("records nothing when the mail fails", async () => {
    const sendMail = async () => {
      throw new Error("resend down");
    };
    const { run, recorded } = await ready([inv(1, "Approved")], { sendMail });
    expect(await run("send", { invoiceIds: [1] })).toEqual({ status: 502, json: { ok: false, error: "send-failed", results: [{ id: 1, outcome: "failed" }] } });
    expect(recorded).toEqual([]);
  });

  it("splits invoices over the limit into numbered mails", async () => {
    const big = Math.ceil(MAX_MAIL_BYTES * 0.6);
    const { run, mails, recorded } = await ready([inv(1, "Approved"), inv(2, "Approved")], { sef: { pdf: async () => new Uint8Array(big) } });
    await run("send", { invoiceIds: [1, 2] });
    expect(mails.map((m) => m.subject)).toEqual([
      "Prihvaćene fakture – Radnja Kod Brata – 19.11.2026. (1/2)",
      "Prihvaćene fakture – Radnja Kod Brata – 19.11.2026. (2/2)",
    ]);
    expect(mails.map((m) => m.attachments.length)).toEqual([1, 1]);
    expect(recorded).toHaveLength(2);
  });

  it("only records the mails that went out", async () => {
    const big = Math.ceil(MAX_MAIL_BYTES * 0.6);
    let n = 0;
    const sendMail = async () => {
      n += 1;
      if (n === 2) throw new Error("resend down");
    };
    const { run, recorded } = await ready([inv(1, "Approved"), inv(2, "Approved")], { sef: { pdf: async () => new Uint8Array(big) }, sendMail });
    const res = await run("send", { invoiceIds: [1, 2] });
    expect(res.json.results).toEqual([
      { id: 1, outcome: "sent" },
      { id: 2, outcome: "failed" },
    ]);
    expect(recorded.map((e) => e.invoiceId)).toEqual([1]);
  });

  it("does not send an invoice that is not accepted", async () => {
    const { run, mails } = await ready([inv(1, "Approved"), inv(2, "Storno")]);
    const res = await run("send", { invoiceIds: [1, 2, 3] });
    expect(res.json.results).toEqual([
      { id: 1, outcome: "sent" },
      { id: 2, outcome: "not-sendable" },
      { id: 3, outcome: "not-sendable" },
    ]);
    expect(mails[0].attachments).toHaveLength(1);
  });

  it("needs a connection and valid ids", async () => {
    const { run } = setup();
    expect((await run("send", { invoiceIds: [1] })).status).toBe(409);
    await connect(run);
    expect((await run("send", { invoiceIds: [] })).json.error).toBe("invalid-ids");
  });
});

describe("reset-mock", () => {
  it("is refused outside the test mode", async () => {
    const { run } = setup({ mode: "production", sef: fakeSef([]) });
    expect(await run("reset-mock")).toEqual({ status: 400, json: { ok: false, error: "not-mock" } });
  });

  it("brings the test invoices back to waiting", async () => {
    const { run } = setup();
    await connect(run);
    const waiting = mockInvoiceDtos(TODAY).find((dto) => dto.status === "New");
    await run("accept", { invoiceIds: [waiting.invoiceId] });
    expect(await run("reset-mock")).toEqual({ status: 200, json: { ok: true } });
    const again = (await run("list")).json.invoices.find((i) => i.id === waiting.invoiceId);
    expect(again.status).toBe("New");
    expect(again.decision).toBeNull();
  });
});

describe("anything else", () => {
  it("refuses an unknown action", async () => {
    const { run } = setup();
    expect(await run("drop-tables")).toEqual({ status: 400, json: { ok: false, error: "bad-action" } });
  });

  it("logs only a code, never the key", async () => {
    const sef = fakeSef([], {
      overview: async () => {
        throw new SefError("sef-unavailable", 503, `echo ${KEY}`);
      },
    });
    const { run, ctx } = setup({ mode: "production", sef });
    ctx.sefFor = () => fakeSef([]).api;
    await connect(run);
    ctx.sefFor = () => sef.api;
    expect(await run("list")).toEqual({ status: 502, json: { ok: false, error: "sef-unavailable" } });
    expect(console.error).toHaveBeenCalledWith("efaktura", "list", "sef-unavailable");
    expect(JSON.stringify(console.error.mock.calls)).not.toContain(KEY);
  });
});

describe("latestDecisions", () => {
  it("keeps each invoice's last accept or reject, ignoring sends", () => {
    const events = [
      { invoiceId: 1, action: "accepted" },
      { invoiceId: 1, action: "sent" },
      { invoiceId: 2, action: "rejected" },
      { invoiceId: 2, action: "accepted" },
    ];
    expect(latestDecisions(events)).toEqual(
      new Map([
        [1, "accepted"],
        [2, "accepted"],
      ])
    );
  });
});


describe("pdf-check (temporary)", () => {
  it("describes the pages of each invoice's PDF, only on a real SEF", async () => {
    const sef = fakeSef([inv(1, "Approved"), inv(2, "New")]);
    const { run } = setup({ mode: "production", sef });
    await connect(run);
    const res = await run("pdf-check", { invoiceIds: [1, 2] });
    expect(res.status).toBe(200);
    expect(res.json.results.map((r) => [r.id, r.pages, r.dropped])).toEqual([
      [1, [{ sef: false, title: false, id: false }], []],
      [2, [{ sef: false, title: false, id: false }], []],
    ]);
    expect((await setup().run("pdf-check", { invoiceIds: [1] })).json.error).toBe("not-real-sef");
  });
});
