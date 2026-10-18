// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import InventoryManualEntry from "./InventoryManualEntry.jsx";
import InventoryScan from "./InventoryScan.jsx";
import { inventoryStore } from "../lib/inventories.js";
import { lookupArticle } from "../lib/products.js";

vi.mock("../lib/inventories.js", () => ({
  inventoryStore: { findItem: vi.fn(), addItem: vi.fn(), addQuantity: vi.fn(), updateItem: vi.fn() },
}));
vi.mock("../lib/products.js", () => ({ lookupArticle: vi.fn() }));
// A camera that always shows the same barcode.
vi.mock("../lib/scanner.js", async (importOriginal) => ({
  ...(await importOriginal()),
  startCamera: vi.fn(async () => ({ deviceId: "cam", torch: false, setTorch: () => {}, stop: () => {} })),
  createDetector: vi.fn(async () => ({ detect: async () => [{ rawValue: "8600005000122" }] })),
}));

beforeAll(() => {
  vi.stubGlobal("requestAnimationFrame", (cb) => setTimeout(() => cb(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id) => clearTimeout(id));
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
});

const onList = { id: "it1", barcode: "8600005000122", name: "MAJONEZ 175", price: 85, quantity: 2, inProducts: true };

const setup = (entries, index = entries.length - 1) =>
  render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <ToastProvider>
        <Routes>
          <Route path="/popis" element={<p>SPISAK POPISA</p>} />
          <Route path="/popis/:id" element={<p>LISTA POPISA</p>} />
          <Route path="/popis/:id/rucni-unos" element={<InventoryManualEntry />} />
          <Route path="/popis/:id/skeniranje" element={<InventoryScan />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

const type = (digits) => {
  for (const d of digits) fireEvent.click(screen.getByRole("button", { name: d }));
};

// act() holds React updates until it returns, so wait in short steps.
const frames = async (ms) => {
  for (let waited = 0; waited < ms; waited += 20) await act(() => new Promise((r) => setTimeout(r, 20)));
};

describe("typing codes into a popis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks what to do with a code that is already on the popis", async () => {
    inventoryStore.findItem.mockResolvedValue(onList);
    setup(["/popis/p1", "/popis/p1/rucni-unos"]);
    type("8600005000122");
    fireEvent.click(screen.getByRole("button", { name: "Nastavi" }));
    expect(await screen.findByText("Artikal je već na popisu")).toBeTruthy();
    expect(inventoryStore.findItem).toHaveBeenCalledWith("p1", "8600005000122");
  });

  it("saves and clears the code for the next one", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: 85 });
    inventoryStore.addItem.mockResolvedValue({ item: { ...onList, quantity: 3 } });
    setup(["/popis/p1", "/popis/p1/rucni-unos"]);
    type("8600005000122");
    fireEvent.click(screen.getByRole("button", { name: "Nastavi" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(await within(dialog).findByLabelText(/Količina/), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sačuvaj i upiši sledeći" }));
    await waitFor(() => expect(inventoryStore.addItem).toHaveBeenCalledWith("p1", expect.objectContaining({ quantity: 3 })));
    await waitFor(() => expect(screen.getByTestId("code").textContent).toBe(""));
    expect(screen.getByRole("status").textContent).toContain("Dodato: MAJONEZ 175");
  });

  it("goes to the list of popisi when this popis was deleted on another phone", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: 85 });
    inventoryStore.addItem.mockResolvedValue({ listGone: true });
    setup(["/popis/p1", "/popis/p1/rucni-unos"]);
    type("8600005000122");
    fireEvent.click(screen.getByRole("button", { name: "Nastavi" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(await within(dialog).findByLabelText(/Količina/), { target: { value: "1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sačuvaj i upiši sledeći" }));
    expect(await screen.findByText("SPISAK POPISA")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Popis više ne postoji");
  });

  it("goes back to the popis when opened directly", async () => {
    setup(["/popis/p1/rucni-unos"]);
    fireEvent.click(await screen.findByRole("button", { name: "Nazad" }));
    expect(await screen.findByText("LISTA POPISA")).toBeTruthy();
  });
});

describe("scanning into a popis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pauses on a read and offers to add to an article already counted", async () => {
    inventoryStore.findItem.mockResolvedValue(onList);
    inventoryStore.addQuantity.mockResolvedValue({ ...onList, quantity: 3 });
    setup(["/popis/p1", "/popis/p1/skeniranje"]);
    await frames(300);
    expect(screen.getByText("Pročitano · kamera na pauzi")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Dodaj količinu" }));
    fireEvent.change(screen.getByLabelText("Koliko dodaješ"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj i skeniraj sledeći" }));
    await waitFor(() => expect(inventoryStore.addQuantity).toHaveBeenCalledWith("it1", 1));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Dodato još 1"));
  });
});
