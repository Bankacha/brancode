// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import EfakturaSettings from "./EfakturaSettings.jsx";
import { EfakturaError, efakturaCall } from "../lib/efaktura.js";

vi.mock("../supabaseClient.js", () => ({ supabase: { auth: { getSession: vi.fn() } } }));
vi.mock("../lib/efaktura.js", async (original) => ({ ...(await original()), efakturaCall: vi.fn() }));

const status = (fields = {}) => ({
  ok: true,
  mode: "production",
  acceptEnabled: false,
  connected: false,
  keyLast4: null,
  shopName: null,
  pib: null,
  shopEmail: "radnja@primer.test",
  sendTo: "radnja@primer.test",
  connectedAt: null,
  ...fields,
});
const connected = (fields = {}) => status({ connected: true, keyLast4: "1234", shopName: "Radnja Kod Brata", pib: "101234567", connectedAt: "2026-11-18T08:00:00Z", ...fields });

const setup = () =>
  render(
    <MemoryRouter initialEntries={["/e-faktura/podesavanja"]}>
      <ToastProvider>
        <Routes>
          <Route path="/e-faktura/podesavanja" element={<EfakturaSettings />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => screen.getByRole("button", { name: "Proveri i sačuvaj" });

describe("EfakturaSettings", () => {
  beforeEach(() => {
    efakturaCall.mockReset();
  });

  it("asks for the name, PIB and key, and checks them before saving", async () => {
    efakturaCall.mockResolvedValueOnce(status()).mockResolvedValueOnce(connected({ shopName: "Radnja" }));
    setup();
    await screen.findByLabelText("API ključ sa SEF-a");
    expect(screen.getByText(/API menadžment/)).toBeTruthy();
    type("Naziv radnje", "Radnja");
    type("PIB", "10123456");
    type("API ključ sa SEF-a", "KLJUC-1234");
    expect(save().disabled).toBe(true);
    type("PIB", "1012345678x");
    expect(screen.getByLabelText("PIB").value).toBe("101234567");
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    await screen.findByText("Ključ sačuvan · završava se na …1234");
    expect(efakturaCall).toHaveBeenLastCalledWith("save-settings", { shopName: "Radnja", pib: "101234567", apiKey: "KLJUC-1234" });
    expect(screen.queryByLabelText("API ključ sa SEF-a")).toBeNull();
  });

  it("needs a key before the first save", async () => {
    efakturaCall.mockResolvedValueOnce(status());
    setup();
    await screen.findByLabelText("API ključ sa SEF-a");
    type("Naziv radnje", "Radnja");
    type("PIB", "101234567");
    expect(save().disabled).toBe(true);
  });

  it("says when SEF refuses the key", async () => {
    efakturaCall.mockResolvedValueOnce(status()).mockRejectedValueOnce(new EfakturaError("key-rejected"));
    setup();
    await screen.findByLabelText("API ključ sa SEF-a");
    type("Naziv radnje", "Radnja");
    type("PIB", "101234567");
    type("API ključ sa SEF-a", "pogresan");
    fireEvent.click(save());
    await screen.findByText("SEF ne prihvata ovaj ključ. Proveri da li je status ključa Aktivan.");
    expect(screen.getByLabelText("API ključ sa SEF-a").value).toBe("pogresan");
  });

  it("shows a saved key only by its last four characters", async () => {
    efakturaCall.mockResolvedValueOnce(connected());
    setup();
    await screen.findByText("Ključ sačuvan · završava se na …1234");
    expect(screen.getByLabelText("Naziv radnje").value).toBe("Radnja Kod Brata");
    for (const input of document.querySelectorAll("input")) expect(input.value).not.toMatch(/KLJUC/);
    expect(screen.queryByLabelText("API ključ sa SEF-a")).toBeNull();
  });

  it("shows where invoices go, locked for now", async () => {
    efakturaCall.mockResolvedValueOnce(connected());
    setup();
    const sendTo = await screen.findByLabelText("Fakture šalji na");
    expect(sendTo.disabled).toBe(true);
    expect(sendTo.value).toBe("radnja@primer.test");
    expect(screen.getByText("Slanje na drugu adresu, npr. knjigovođi, biće moguće uskoro.")).toBeTruthy();
  });

  it("does not show the send address before connecting", async () => {
    efakturaCall.mockResolvedValueOnce(status());
    setup();
    await screen.findByLabelText("API ključ sa SEF-a");
    expect(screen.queryByLabelText("Fakture šalji na")).toBeNull();
  });

  it("marks the test mode and warns against the real key there", async () => {
    efakturaCall.mockResolvedValueOnce(status({ mode: "mock" }));
    setup();
    await screen.findByText("Probni režim: izmišljene fakture, SEF se ne poziva.");
    expect(screen.getByText(/ne pravi ključ/)).toBeTruthy();
  });

  it("asks before removing the key", async () => {
    efakturaCall.mockResolvedValueOnce(connected()).mockResolvedValueOnce(status({ shopName: "Radnja Kod Brata", pib: "101234567" }));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Ukloni ključ" }));
    expect(efakturaCall).toHaveBeenCalledTimes(1);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Ukloni" }));
    await waitFor(() => expect(efakturaCall).toHaveBeenLastCalledWith("remove-key"));
    await screen.findByLabelText("API ključ sa SEF-a");
  });

  it("saves a new name without a new key", async () => {
    efakturaCall.mockResolvedValueOnce(connected()).mockResolvedValueOnce(connected({ shopName: "Nova Radnja" }));
    setup();
    await screen.findByText("Ključ sačuvan · završava se na …1234");
    type("Naziv radnje", "Nova Radnja");
    fireEvent.click(save());
    await waitFor(() => expect(efakturaCall).toHaveBeenLastCalledWith("save-settings", { shopName: "Nova Radnja", pib: "101234567" }));
  });

  it("opens the key field to replace the key", async () => {
    efakturaCall.mockResolvedValueOnce(connected()).mockResolvedValueOnce(connected({ keyLast4: "9999" }));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Zameni ključ" }));
    expect(save().disabled).toBe(true);
    type("API ključ sa SEF-a", "NOVI-9999");
    fireEvent.click(save());
    await screen.findByText("Ključ sačuvan · završava se na …9999");
    expect(efakturaCall).toHaveBeenLastCalledWith("save-settings", { shopName: "Radnja Kod Brata", pib: "101234567", apiKey: "NOVI-9999" });
  });
});
