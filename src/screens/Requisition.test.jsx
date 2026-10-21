// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import Requisition from "./Requisition.jsx";
import { requisitionStore } from "../lib/requisitions.js";

vi.mock("../lib/requisitions.js", async (importOriginal) => ({
  ...(await importOriginal()),
  requisitionStore: { get: vi.fn(), items: vi.fn(), list: vi.fn(), update: vi.fn(), removeItem: vi.fn(), restoreItem: vi.fn(), updateItem: vi.fn(), findItem: vi.fn(), addItem: vi.fn(), addQuantity: vi.fn() },
}));
vi.mock("../lib/products.js", () => ({ lookupArticle: vi.fn() }));
vi.mock("../lib/leafletMarks.js", () => ({
  withLeafletMarks: vi.fn(async (_store, _date, list) => list.map((item) => ({ ...item, onLeaflet: item.id === "a" }))),
}));

export const trebovanje = { id: "t1", title: "Pekara", date: "2026-10-18", createdAt: "x" };
export const items = [
  { id: "a", barcode: "8600005000122", name: "MAJONEZ 175", price: 85, quantity: 2 },
  { id: "b", barcode: null, name: "Hleb za sendviče", price: null, quantity: null },
];

const setup = () =>
  render(
    <MemoryRouter initialEntries={["/trebovanje", "/trebovanje/t1"]} initialIndex={1}>
      <ToastProvider>
        <Routes>
          <Route path="/trebovanje" element={<p>SPISAK TREBOVANJA</p>} />
          <Route path="/trebovanje/:id" element={<Requisition />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

describe("Requisition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requisitionStore.get.mockResolvedValue(trebovanje);
    requisitionStore.items.mockResolvedValue(items);
  });

  it("shows the trebovanje with what each item has: an item can be just a name", async () => {
    setup();
    expect(await screen.findByText("Pekara 18.10.2026")).toBeTruthy();
    const majonez = screen.getByText("MAJONEZ 175").closest("li");
    expect(within(majonez).getByText("8600005000122 · 85,00")).toBeTruthy();
    expect(within(majonez).getByText("2")).toBeTruthy();
    const hleb = screen.getByText("Hleb za sendviče").closest("li");
    expect(hleb.textContent).toBe("Hleb za sendviče");
  });

  it("marks the price that is the leaflet price", async () => {
    setup();
    await screen.findByText("Pekara 18.10.2026");
    expect(within(screen.getByText("MAJONEZ 175").closest("li")).getByText("Liflet")).toBeTruthy();
    expect(within(screen.getByText("Hleb za sendviče").closest("li")).queryByText("Liflet")).toBeNull();
  });

  it("goes back to the list of trebovanja when this one no longer exists", async () => {
    requisitionStore.get.mockResolvedValue(null);
    setup();
    expect(await screen.findByText("SPISAK TREBOVANJA")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Trebovanje više ne postoji");
  });
});
