// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import RequisitionManualEntry from "./RequisitionManualEntry.jsx";
import { requisitionStore } from "../lib/requisitions.js";

vi.mock("../lib/requisitions.js", async (importOriginal) => ({
  ...(await importOriginal()),
  requisitionStore: { findItem: vi.fn(), addItem: vi.fn(), addQuantity: vi.fn(), updateItem: vi.fn() },
}));
vi.mock("../lib/products.js", () => ({ lookupArticle: vi.fn(async () => null) }));

const setup = () =>
  render(
    <MemoryRouter initialEntries={["/trebovanje/t1", "/trebovanje/t1/rucni-unos"]} initialIndex={1}>
      <ToastProvider>
        <Routes>
          <Route path="/trebovanje/:id" element={<p>LISTA TREBOVANJA</p>} />
          <Route path="/trebovanje/:id/rucni-unos" element={<RequisitionManualEntry />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

describe("typing into a trebovanje", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds an item with just a name, without a barcode", async () => {
    requisitionStore.addItem.mockResolvedValue({ item: { id: "r1", name: "Hleb za sendviče", quantity: null } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Bez barkoda" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Bez barkoda")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Naziv"), { target: { value: "Hleb za sendviče" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sačuvaj i upiši sledeći" }));
    await waitFor(() =>
      expect(requisitionStore.addItem).toHaveBeenCalledWith("t1", { barcode: null, name: "Hleb za sendviče", price: null, quantity: null, inProducts: false })
    );
    expect(requisitionStore.findItem).not.toHaveBeenCalled();
  });

  it("clears digits typed before choosing Bez barkoda", async () => {
    setup();
    for (const d of "123") fireEvent.click(screen.getByRole("button", { name: d }));
    fireEvent.click(screen.getByRole("button", { name: "Bez barkoda" }));
    expect(screen.getByTestId("code").textContent).toBe("");
  });

  it("asks what to do with a code that is already on the trebovanje", async () => {
    requisitionStore.findItem.mockResolvedValue({ id: "r2", barcode: "12345", name: "Mleko", price: null, quantity: null });
    setup();
    for (const d of "12345") fireEvent.click(screen.getByRole("button", { name: d }));
    fireEvent.click(screen.getByRole("button", { name: "Nastavi" }));
    expect(await screen.findByText("Artikal je već na trebovanju")).toBeTruthy();
    expect(screen.getByText(/na trebovanju: bez količine/)).toBeTruthy();
  });
});
