// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import Requisition from "./Requisition.jsx";
import { requisitionStore } from "../lib/requisitions.js";

vi.mock("../lib/requisitions.js", async (importOriginal) => ({
  ...(await importOriginal()),
  requisitionStore: {
    get: vi.fn(), items: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), removeItem: vi.fn(), restoreItem: vi.fn(),
    updateItem: vi.fn(), findItem: vi.fn(), addItem: vi.fn(), addQuantity: vi.fn(),
  },
}));
vi.mock("../lib/products.js", () => ({ lookupArticle: vi.fn() }));

const t1 = { id: "t1", title: "Pekara", date: "2026-10-17", createdAt: "a" };
const items = [
  { id: "a", barcode: "111", name: "Mleko", price: 100, quantity: 3 },
  { id: "b", barcode: null, name: "Hleb za sendviče", price: null, quantity: null },
];

// t1 is the trebovanje on screen; any other id is where the items went.
function Screen() {
  const { id } = useParams();
  return id === "t1" ? <Requisition /> : <p>CILJ {id}</p>;
}

const setup = () =>
  render(
    <MemoryRouter initialEntries={["/trebovanje", "/trebovanje/t1"]} initialIndex={1}>
      <ToastProvider>
        <Routes>
          <Route path="/trebovanje/:id" element={<Screen />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

const selectAllAndOpen = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Prenesi stavke" }));
  fireEvent.click(screen.getByRole("button", { name: "Izaberi sve" }));
  expect(screen.getAllByRole("checkbox").every((box) => box.getAttribute("aria-checked") === "true")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Prenesi (2)" }));
};

describe("Prenesi stavke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requisitionStore.get.mockResolvedValue(t1);
    requisitionStore.items.mockResolvedValue(items);
    requisitionStore.list.mockResolvedValue([
      { id: "t2", title: "", date: "2026-10-18", createdAt: "b", itemCount: 1 },
      { ...t1, itemCount: 2 },
    ]);
    requisitionStore.findItem.mockResolvedValue(null);
    requisitionStore.addItem.mockResolvedValue({ item: {} });
  });

  it("picks items one by one and counts them on the button", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Prenesi stavke" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mleko" }));
    expect(screen.getByRole("button", { name: "Prenesi (1)" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ukloni" })).toBeNull();
  });

  it("copies the chosen items into another trebovanje and opens it", async () => {
    setup();
    await selectAllAndOpen();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText("Pekara 17.10.2026")).toBeNull(); // not into itself
    fireEvent.click(await within(dialog).findByText("18.10.2026"));
    expect(await screen.findByText("CILJ t2")).toBeTruthy();
    expect(requisitionStore.addItem).toHaveBeenCalledWith("t2", { barcode: "111", name: "Mleko", price: 100, quantity: 3 });
    expect(requisitionStore.addItem).toHaveBeenCalledWith("t2", { barcode: null, name: "Hleb za sendviče", price: null, quantity: null });
    expect(screen.getByRole("status").textContent).toContain("Preneseno: 2");
  });

  it("makes a new trebovanje for the chosen items", async () => {
    requisitionStore.create.mockResolvedValue({ id: "t3", title: "", date: "2026-10-19", createdAt: "c" });
    setup();
    await selectAllAndOpen();
    fireEvent.click(await screen.findByRole("button", { name: /Novo trebovanje sa izabranim stavkama/ }));
    fireEvent.change(screen.getByLabelText("Datum"), { target: { value: "2026-10-19" } });
    fireEvent.click(screen.getByRole("button", { name: "Napravi i prenesi" }));
    expect(await screen.findByText("CILJ t3")).toBeTruthy();
    expect(requisitionStore.create).toHaveBeenCalledWith({ title: "", date: "2026-10-19" });
    await waitFor(() => expect(requisitionStore.addItem).toHaveBeenCalledTimes(2));
  });

  it("says how many were copied when the connection drops halfway", async () => {
    requisitionStore.addItem.mockResolvedValueOnce({ item: {} }).mockRejectedValueOnce(new Error("Failed to fetch"));
    setup();
    await selectAllAndOpen();
    fireEvent.click(await within(await screen.findByRole("dialog")).findByText("18.10.2026"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Preneseno 1 od 2"));
    expect(screen.queryByText("CILJ t2")).toBeNull();
  });
});
