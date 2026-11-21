import { describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { runEfakturaAction } from "./efakturaActions.js";
import { createMemoryEfakturaStore } from "./efakturaMemoryStore.js";

// When merging itself breaks (pdf-lib throws while saving), the invoices still
// go, each as its own PDF, and the screen still gets the results.
vi.mock("./efakturaPdf.js", () => ({
  mergePdfs: async () => {
    throw new Error("pdf-lib broke");
  },
  describePages: async () => ({}),
}));

describe("send when merging fails", () => {
  it("attaches every PDF on its own", async () => {
    const invoice = { id: 1, number: "1/2026", supplier: "Dobavljač 1", amount: 100, currency: "RSD", status: "Approved", receivedAt: "2026-11-18T08:00:00Z" };
    const mails = [];
    const sef = {
      checkKey: async () => {},
      overview: async () => [invoice],
      pdfMany: async () => new Map([[1, new Uint8Array([37, 80, 68, 70])]]),
    };
    const ctx = {
      mode: "production",
      acceptEnabled: true,
      secret: randomBytes(32).toString("base64"),
      store: createMemoryEfakturaStore({ now: () => new Date("2026-11-19T09:00:00Z") }),
      sefFor: () => sef,
      sendMail: async (mail) => mails.push(mail),
      shopEmail: "radnja@primer.test",
      user: { id: "u1", email: "brat@primer.test" },
      now: () => new Date("2026-11-19T09:00:00Z"),
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    await runEfakturaAction("save-settings", { shopName: "Radnja", pib: "101234567", apiKey: "KLJUC-1234" }, ctx);
    const res = await runEfakturaAction("send", { invoiceIds: [1] }, ctx);
    expect(res.json.results).toEqual([{ id: 1, outcome: "sent" }]);
    expect(mails[0].attachments.map((a) => a.filename)).toEqual(["Dobavljač 1 – 1-2026.pdf"]);
  });
});
