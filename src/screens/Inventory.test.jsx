// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import Inventory from "./Inventory.jsx";
import { inventoryStore } from "../lib/inventories.js";
import { buildPdfBlob } from "../lib/listPdf.js";
import { sendFileByEmail } from "../lib/email.js";
import { downloadBlob } from "../lib/download.js";

vi.mock("../lib/inventories.js", () => ({
  inventoryStore: { get: vi.fn(), items: vi.fn(), update: vi.fn(), removeItem: vi.fn(), restoreItem: vi.fn(), updateItem: vi.fn(), findItem: vi.fn(), addItem: vi.fn(), addQuantity: vi.fn() },
}));
vi.mock("../lib/products.js", () => ({ lookupArticle: vi.fn() }));
vi.mock("../lib/listPdf.js", async (importOriginal) => ({ ...(await importOriginal()), buildPdfBlob: vi.fn(async () => new Blob(["%PDF"])) }));
vi.mock("../lib/email.js", () => ({ sendFileByEmail: vi.fn() }));
vi.mock("../lib/download.js", () => ({ downloadBlob: vi.fn() }));

const popis = { id: "p1", title: "Magacin", dateFrom: "2026-10-01", dateTo: "2026-10-18", createdAt: "x" };
const items = [
  { id: "a", barcode: "8600005000122", name: "MAJONEZ 175", price: 85, quantity: 2, inProducts: true },
  { id: "b", barcode: "12345", name: "Hleb", price: 79.5, quantity: 1.5, inProducts: false },
];

const setup = (path = "/popis/p1") =>
  render(
    <MemoryRouter initialEntries={["/popis", path]} initialIndex={1}>
      <ToastProvider>
        <Routes>
          <Route path="/popis" element={<p>SPISAK POPISA</p>} />
          <Route path="/popis/:id" element={<Inventory />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

const longPress = async (el) => {
  fireEvent.pointerDown(el, { clientX: 5, clientY: 5 });
  await act(() => new Promise((r) => setTimeout(r, 600)));
  fireEvent.pointerUp(el);
};

describe("Inventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inventoryStore.get.mockResolvedValue(popis);
    inventoryStore.items.mockResolvedValue(items);
  });

  it("shows the popis with its items: name, barcode, price and quantity", async () => {
    setup();
    expect(await screen.findByText("Magacin · 01.10.2026 – 18.10.2026")).toBeTruthy();
    const hleb = screen.getByText("Hleb").closest("li");
    expect(within(hleb).getByText("12345 · 79,50")).toBeTruthy();
    expect(within(hleb).getByText("1,5")).toBeTruthy();
    expect(screen.getByText("2 stavke")).toBeTruthy();
  });

  it("removes an item with X and puts it back with Vrati", async () => {
    inventoryStore.removeItem.mockResolvedValue();
    inventoryStore.restoreItem.mockResolvedValue(items[1]);
    setup();
    const hleb = (await screen.findByText("Hleb")).closest("li");
    fireEvent.click(within(hleb).getByRole("button", { name: "Ukloni" }));
    expect(screen.queryByText("Hleb")).toBeNull();
    await waitFor(() => expect(inventoryStore.removeItem).toHaveBeenCalledWith("b"));
    fireEvent.click(screen.getByText("Vrati"));
    await waitFor(() => expect(inventoryStore.restoreItem).toHaveBeenCalledWith("p1", items[1]));
  });

  it("edits an item on a long press, with the name and price of a database article locked", async () => {
    inventoryStore.updateItem.mockResolvedValue({ ...items[0], quantity: 5 });
    setup();
    await longPress(await screen.findByText("MAJONEZ 175"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Naziv").readOnly).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Količina/), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sačuvaj" }));
    await waitFor(() => expect(inventoryStore.updateItem).toHaveBeenCalledWith("a", { name: "MAJONEZ 175", price: 85, quantity: 5 }));
  });

  it("goes back to the list of popisi when this one no longer exists", async () => {
    inventoryStore.get.mockResolvedValue(null);
    setup();
    expect(await screen.findByText("SPISAK POPISA")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Popis više ne postoji");
  });

  it("downloads the popis as a PDF, made from the latest items", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Izvoz" }));
    fireEvent.click(screen.getByRole("button", { name: /Preuzmi PDF/ }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "popis-2026-10-01_2026-10-18.pdf"));
    expect(inventoryStore.items).toHaveBeenCalledTimes(2); // loaded again before export
    const [definition] = buildPdfBlob.mock.calls[0];
    expect(JSON.stringify(definition)).toContain("MAJONEZ 175");
  });

  it("emails the PDF with a popis subject, and says when it is too big", async () => {
    sendFileByEmail.mockRejectedValueOnce(new Error("file-too-large"));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Izvoz" }));
    fireEvent.click(screen.getByRole("button", { name: /Pošalji mejlom/ }));
    await waitFor(() => expect(sendFileByEmail).toHaveBeenCalledWith("popis-2026-10-01_2026-10-18.pdf", expect.any(Blob), { subject: "Popis – Magacin · 01.10.2026 – 18.10.2026" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("prevelik za mejl"));
  });
});
