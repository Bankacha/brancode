// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { SessionProvider } from "../auth/session.jsx";
import { ToastProvider } from "../components/Toast.jsx";
import Efaktura from "./Efaktura.jsx";
import { efakturaCall } from "../lib/efaktura.js";

vi.mock("../supabaseClient.js", () => ({ supabase: { auth: { getSession: vi.fn(), signOut: vi.fn() } } }));
vi.mock("../lib/efaktura.js", async (original) => ({ ...(await original()), efakturaCall: vi.fn(), efakturaPdf: vi.fn() }));

const at = (daysAgo, hour = 8) => new Date(Date.UTC(2026, 10, 19 - daysAgo, hour)).toISOString();
const unsent = { state: "unsent", lastSentAt: null, lastSentTo: null };
const inv = (id, fields = {}) => ({
  id,
  number: `${id}/2026`,
  supplier: `Dobavljač ${id}`,
  supplierPib: "100000017",
  amount: 1200,
  amountWithoutVat: 1000,
  vat: 200,
  currency: "RSD",
  status: "New",
  receivedAt: at(0),
  dueDate: "2026-12-19",
  send: null,
  decision: null,
  ...fields,
});

const INVOICES = [
  inv(1),
  inv(2, { receivedAt: at(0, 9) }),
  inv(3, { receivedAt: at(0, 10) }),
  inv(4, { status: "Seen", receivedAt: at(1) }),
  inv(5, { status: "Approved", receivedAt: at(2), send: unsent, decision: { action: "accepted", userEmail: "brat@primer.test", at: "2026-11-17T07:42:00Z", comment: null } }),
  inv(6, { status: "Approved", receivedAt: at(3), send: unsent }),
  inv(7, { status: "Approved", receivedAt: at(5), send: { state: "sent", lastSentAt: "2026-11-18T09:00:00Z", lastSentTo: "radnja@primer.test" } }),
  inv(8, { status: "Approved", receivedAt: at(30), send: { state: "before", lastSentAt: null, lastSentTo: null } }),
  inv(9, { status: "Rejected", receivedAt: at(6) }),
  inv(10, { status: "Storno", receivedAt: at(7) }),
];

const STATUS = {
  ok: true,
  mode: "production",
  acceptEnabled: true,
  connected: true,
  keyLast4: "1234",
  shopName: "Radnja",
  pib: "101234567",
  shopEmail: "radnja@primer.test",
  sendTo: "radnja@primer.test",
  connectedAt: "2026-11-01T08:00:00Z",
};

// The server, one handler per action.
const serve = ({ status = STATUS, list = INVOICES, ...handlers } = {}) => {
  const api = {
    status: vi.fn(async () => status),
    list: vi.fn(async () => ({ ok: true, invoices: typeof list === "function" ? list() : list })),
    accept: vi.fn(async ({ invoiceIds }) => ({ ok: true, results: invoiceIds.map((id) => ({ id, outcome: "done" })) })),
    reject: vi.fn(async ({ invoiceId }) => ({ ok: true, results: [{ id: invoiceId, outcome: "done" }] })),
    send: vi.fn(async ({ invoiceIds }) => ({ ok: true, recipient: "radnja@primer.test", results: invoiceIds.map((id) => ({ id, outcome: "sent" })) })),
    "reset-mock": vi.fn(async () => ({ ok: true })),
    ...handlers,
  };
  efakturaCall.mockImplementation(async (action, payload) => api[action](payload));
  return api;
};

const setup = () =>
  render(
    <SessionProvider value={{ user: { email: "brat@primer.test" } }}>
      <MemoryRouter initialEntries={["/e-faktura"]}>
        <ToastProvider>
          <Routes>
            <Route path="/e-faktura" element={<Efaktura />} />
            <Route path="/e-faktura/podesavanja" element={<p>PODESAVANJA</p>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </SessionProvider>
  );

const region = (name) => screen.getByRole("region", { name });
const checkbox = (id) => screen.getByRole("checkbox", { name: `Izaberi: Dobavljač ${id}, ${id}/2026` });
const tab = (name) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const dialog = (name) => screen.getByRole("dialog", { name });
const loaded = () => screen.findByRole("region", { name: "Danas" });

describe("Efaktura", () => {
  beforeEach(() => {
    efakturaCall.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-19T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("leads to the settings when e-Faktura is not connected", async () => {
    const api = serve({ status: { ...STATUS, connected: false, keyLast4: null } });
    setup();
    await screen.findByText("e-Faktura nije povezana.");
    expect(api.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Poveži e-Fakturu" }));
    await screen.findByText("PODESAVANJA");
  });

  it("shows three tabs with counts and groups waiting invoices by day", async () => {
    serve();
    setup();
    await loaded();
    // plain labels, like the price format tabs; the count sits under the tabs
    expect(tab("Na čekanju").textContent).toBe("Na čekanju");
    expect(tab("Prihvaćene").textContent).toBe("Prihvaćene");
    expect(tab("Sve").textContent).toBe("Sve");
    expect(screen.getByText("4 fakture · ukupno 4.800,00 din")).toBeTruthy();
    fireEvent.click(tab("Prihvaćene"));
    expect(screen.getByText("4 fakture · 2 za slanje")).toBeTruthy();
    fireEvent.click(tab("Sve"));
    expect(screen.getByText("10 faktura u poslednjih 60 dana")).toBeTruthy();
    fireEvent.click(tab("Na čekanju"));
    expect(within(region("Danas")).getAllByRole("checkbox")).toHaveLength(3);
    expect(within(region("Juče")).getAllByRole("checkbox")).toHaveLength(1);
    expect(within(region("Danas")).getAllByText("još 15 dana").length).toBe(3);
    // the due date under the amount, without its year, so nothing is cut off on a phone
    expect(within(region("Danas")).getAllByText("Valuta 19.12.")).toHaveLength(3);
    expect(within(region("Danas")).getByText("1/2026")).toBeTruthy();
  });

  it("selects a whole day and shows the total", async () => {
    serve();
    setup();
    await loaded();
    fireEvent.click(within(region("Danas")).getByRole("button", { name: "Izaberi sve" }));
    expect(checkbox(1).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("button", { name: "Prihvati (3) · ukupno 3.600,00 din" })).toBeTruthy();
    fireEvent.click(within(region("Danas")).getByRole("button", { name: "Poništi izbor" }));
    expect(screen.queryByRole("button", { name: /^Prihvati \(/ })).toBeNull();
  });

  it("asks before accepting, then accepts the chosen invoices", async () => {
    const api = serve();
    setup();
    await loaded();
    fireEvent.click(within(region("Danas")).getByRole("button", { name: "Izaberi sve" }));
    fireEvent.click(screen.getByRole("button", { name: /^Prihvati \(3\)/ }));
    const confirm = dialog("Prihvatiti 3 fakture?");
    expect(within(confirm).getByText("Ukupno 3.600,00 din. Prihvatanje odmah ide u SEF.")).toBeTruthy();
    expect(api.accept).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Prihvati" }));
    await screen.findByText("Prihvaćene 3 fakture");
    expect([...api.accept.mock.calls[0][0].invoiceIds].sort()).toEqual([1, 2, 3]);
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });

  it("sends one accept request on a double tap", async () => {
    let finish;
    const api = serve({ accept: vi.fn(() => new Promise((resolve) => (finish = resolve))) });
    setup();
    await loaded();
    fireEvent.click(checkbox(1));
    fireEvent.click(screen.getByRole("button", { name: /^Prihvati \(1\)/ }));
    const yes = within(dialog("Prihvatiti 1 fakturu?")).getByRole("button", { name: "Prihvati" });
    fireEvent.click(yes);
    fireEvent.click(yes);
    await waitFor(() => expect(api.accept).toHaveBeenCalledTimes(1));
    expect(yes.disabled).toBe(true);
    finish({ ok: true, results: [{ id: 1, outcome: "done" }] });
    await screen.findByText("Prihvaćena 1 faktura");
    expect(api.accept).toHaveBeenCalledTimes(1);
  });

  it("says which invoices were not accepted and keeps them chosen", async () => {
    serve({
      accept: vi.fn(async () => ({
        ok: true,
        results: [
          { id: 3, outcome: "done" },
          { id: 2, outcome: "already", status: "Approved" },
          { id: 1, outcome: "failed", status: "New", message: "SEF kaže ne" },
        ],
      })),
    });
    setup();
    await loaded();
    fireEvent.click(within(region("Danas")).getByRole("button", { name: "Izaberi sve" }));
    fireEvent.click(screen.getByRole("button", { name: /^Prihvati \(3\)/ }));
    fireEvent.click(within(dialog("Prihvatiti 3 fakture?")).getByRole("button", { name: "Prihvati" }));
    await screen.findByText("Prihvaćeno 2 od 3, 1 nije: SEF kaže ne");
    expect(checkbox(1).getAttribute("aria-checked")).toBe("true");
    expect(checkbox(3).getAttribute("aria-checked")).toBe("false");
  });

  it("drops invoices that are no longer pending from the selection after a reload", async () => {
    const lists = [INVOICES, INVOICES.map((i) => (i.id === 4 ? { ...i, status: "Approved", send: unsent } : i))];
    serve({ list: () => lists.shift() ?? INVOICES });
    setup();
    await loaded();
    fireEvent.click(checkbox(1));
    fireEvent.click(checkbox(4));
    expect(screen.getByRole("button", { name: "Prihvati (2) · ukupno 2.400,00 din" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Osveži" }));
    await screen.findByRole("button", { name: "Prihvati (1) · ukupno 1.200,00 din" });
  });

  it("does not call an invoice rejected elsewhere accepted", async () => {
    serve({
      accept: vi.fn(async () => ({
        ok: true,
        results: [
          { id: 3, outcome: "done" },
          { id: 2, outcome: "already", status: "Rejected" },
          { id: 1, outcome: "done" },
        ],
      })),
    });
    setup();
    await loaded();
    fireEvent.click(within(region("Danas")).getByRole("button", { name: "Izaberi sve" }));
    fireEvent.click(screen.getByRole("button", { name: /^Prihvati \(3\)/ }));
    fireEvent.click(within(dialog("Prihvatiti 3 fakture?")).getByRole("button", { name: "Prihvati" }));
    await screen.findByText("Prihvaćeno 2 od 3. Dobavljač 2 – 2/2026 je već odbijena.");
    expect(checkbox(2).getAttribute("aria-checked")).toBe("false");
  });

  it("accepts a long selection in parts of 20", async () => {
    const many = Array.from({ length: 120 }, (_, i) => inv(i + 1, { receivedAt: at(0, 7) }));
    const api = serve({ list: many });
    setup();
    await loaded();
    fireEvent.click(within(region("Danas")).getByRole("button", { name: "Izaberi sve" }));
    fireEvent.click(screen.getByRole("button", { name: /^Prihvati \(120\)/ }));
    fireEvent.click(within(dialog("Prihvatiti 120 faktura?")).getByRole("button", { name: "Prihvati" }));
    await screen.findByText("Prihvaćeno 120 faktura");
    expect(api.accept.mock.calls.map(([payload]) => payload.invoiceIds.length)).toEqual([20, 20, 20, 20, 20, 20]);
  });

  it("locks accepting until it is switched on", async () => {
    serve({ status: { ...STATUS, acceptEnabled: false } });
    setup();
    await loaded();
    fireEvent.click(checkbox(1));
    expect(screen.getByRole("button", { name: /^Prihvati \(1\)/ }).disabled).toBe(true);
    expect(screen.getByText("Prihvatanje još nije uključeno")).toBeTruthy();
  });

  it("offers the unsent accepted invoices for sending, all chosen", async () => {
    const api = serve();
    setup();
    await loaded();
    fireEvent.click(tab("Prihvaćene"));
    const waiting = region("Nije poslato");
    expect(within(waiting).getAllByRole("checkbox").every((box) => box.getAttribute("aria-checked") === "true")).toBe(true);
    expect(within(region("Poslato")).getByText("Poslato 18.11. na radnja@primer.test")).toBeTruthy();
    expect(region("Pre povezivanja")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pošalji (2)" }));
    // the address sits under the title, where a long one can wrap
    expect(within(dialog("Poslati 2 fakture?")).getByText("radnja@primer.test")).toBeTruthy();
    expect(within(dialog("Poslati 2 fakture?")).getByText(/u jednom PDF-u/)).toBeTruthy();
    fireEvent.click(within(dialog("Poslati 2 fakture?")).getByRole("button", { name: "Pošalji" }));
    await screen.findByText("Poslate 2 fakture na radnja@primer.test");
    expect([...api.send.mock.calls[0][0].invoiceIds].sort()).toEqual([5, 6]);
  });

  it("names the invoice that was not sent", async () => {
    serve({
      send: vi.fn(async () => ({
        ok: true,
        recipient: "radnja@primer.test",
        results: [
          { id: 5, outcome: "sent" },
          { id: 6, outcome: "failed" },
        ],
      })),
    });
    setup();
    await loaded();
    fireEvent.click(tab("Prihvaćene"));
    fireEvent.click(screen.getByRole("button", { name: "Pošalji (2)" }));
    fireEvent.click(within(dialog("Poslati 2 fakture?")).getByRole("button", { name: "Pošalji" }));
    await screen.findByText("Poslato 1 od 2. Dobavljač 6 – 6/2026 nije poslata, pokušaj ponovo.");
  });

  it("says when an invoice can no longer be sent", async () => {
    serve({ send: vi.fn(async () => ({ ok: true, recipient: "radnja@primer.test", results: [{ id: 5, outcome: "sent" }, { id: 6, outcome: "not-sendable" }] })) });
    setup();
    await loaded();
    fireEvent.click(tab("Prihvaćene"));
    fireEvent.click(screen.getByRole("button", { name: "Pošalji (2)" }));
    fireEvent.click(within(dialog("Poslati 2 fakture?")).getByRole("button", { name: "Pošalji" }));
    await screen.findByText("Poslato 1 od 2. Dobavljač 6 – 6/2026 više nije prihvaćena na SEF-u.");
  });

  it("sends up to 50 invoices in one request, so they come as one PDF", async () => {
    const many = Array.from({ length: 55 }, (_, i) => inv(i + 1, { status: "Approved", receivedAt: at(1, 7), send: unsent }));
    const api = serve({ list: many });
    setup();
    await screen.findByRole("button", { name: /^Prihvaćene/ });
    fireEvent.click(tab("Prihvaćene"));
    fireEvent.click(screen.getByRole("button", { name: "Pošalji (55)" }));
    fireEvent.click(within(dialog("Poslati 55 faktura?")).getByRole("button", { name: "Pošalji" }));
    await screen.findByText("Poslato 55 faktura na radnja@primer.test");
    expect(api.send.mock.calls.map(([payload]) => payload.invoiceIds.length)).toEqual([50, 5]);
  });

  it("shows every invoice under Sve, with its status and no checkboxes", async () => {
    serve();
    setup();
    await loaded();
    fireEvent.click(tab("Sve"));
    expect(screen.getByText("Odbijena")).toBeTruthy();
    expect(screen.getByText("Stornirana")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("rejects from the invoice's details, only with a reason", async () => {
    const api = serve();
    setup();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Dobavljač 1, 1/2026" }));
    fireEvent.click(await screen.findByRole("button", { name: "Odbij" }));
    const reject = dialog("Odbiti fakturu?");
    const confirm = within(reject).getByRole("button", { name: "Odbij" });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(reject).getByLabelText("Razlog odbijanja"), { target: { value: "  Pogrešna cena " } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(api.reject).toHaveBeenCalledWith({ invoiceId: 1, comment: "Pogrešna cena" }));
    await screen.findByText("Faktura odbijena");
  });

  it("shows who accepted an invoice through the app", async () => {
    serve();
    setup();
    await loaded();
    fireEvent.click(tab("Prihvaćene"));
    fireEvent.click(screen.getByRole("button", { name: "Dobavljač 5, 5/2026" }));
    await screen.findByText("Prihvatio: brat@primer.test, 17.11. u 08:42");
  });

  it("marks the test mode and brings the test invoices back", async () => {
    const api = serve({ status: { ...STATUS, mode: "mock" } });
    setup();
    await loaded();
    expect(screen.getByText("Probni režim: izmišljene fakture, SEF se ne poziva.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vrati probne fakture" }));
    await waitFor(() => expect(api["reset-mock"]).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });

  it("leads to the settings when the first load fails", async () => {
    serve({
      list: () => {
        throw Object.assign(new Error("x"), { code: "key-rejected" });
      },
    });
    setup();
    await screen.findByText("SEF ne prihvata ovaj ključ. Proveri da li je status ključa Aktivan.");
    fireEvent.click(screen.getByRole("button", { name: "Podešavanja e-Fakture" }));
    await screen.findByText("PODESAVANJA");
  });

  it("keeps the list and says so when a reload fails", async () => {
    let calls = 0;
    serve({
      list: () => {
        calls += 1;
        if (calls > 1) throw Object.assign(new Error("x"), { code: "sef-unavailable" });
        return INVOICES;
      },
    });
    setup();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Osveži" }));
    await screen.findByText("SEF trenutno ne odgovara. Pokušaj ponovo.");
    expect(region("Danas")).toBeTruthy();
  });
});
