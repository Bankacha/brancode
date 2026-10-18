// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import { SessionProvider } from "../auth/session.jsx";
import InventoryLists from "./InventoryLists.jsx";
import { inventoryStore } from "../lib/inventories.js";

vi.mock("../lib/inventories.js", () => ({ inventoryStore: { list: vi.fn(), create: vi.fn(), remove: vi.fn() } }));
vi.mock("../supabaseClient", () => ({ supabase: { auth: { signOut: vi.fn() } } }));

const popis = (id, itemCount, title = "") => ({ id, title, dateFrom: "2026-10-01", dateTo: "2026-10-18", createdAt: "x", itemCount });

function Opened() {
  return <p>OTVOREN {useParams().id}</p>;
}

const setup = () =>
  render(
    <SessionProvider value={{ user: { email: "b@b.com" } }}>
      <MemoryRouter initialEntries={["/popis"]}>
        <ToastProvider>
          <Routes>
            <Route path="/popis" element={<InventoryLists />} />
            <Route path="/popis/:id" element={<Opened />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </SessionProvider>
  );

const longPress = async (el) => {
  fireEvent.pointerDown(el, { clientX: 5, clientY: 5 });
  await act(() => new Promise((r) => setTimeout(r, 600)));
  fireEvent.pointerUp(el);
};

describe("InventoryLists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 18, 21, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("lists popisi with their names and item counts", async () => {
    inventoryStore.list.mockResolvedValue([popis("a", 1, "Magacin"), popis("b", 5)]);
    setup();
    expect(await screen.findByText("Magacin · 01.10.2026 – 18.10.2026")).toBeTruthy();
    expect(screen.getByText("1 stavka")).toBeTruthy();
    expect(screen.getByText("5 stavki")).toBeTruthy();
  });

  it("creates a popis for this month so far and opens it", async () => {
    inventoryStore.list.mockResolvedValue([]);
    inventoryStore.create.mockResolvedValue(popis("nov", 0));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Novi popis/ }));
    expect(screen.getByLabelText("Od").value).toBe("2026-10-01");
    expect(screen.getByLabelText("Do").value).toBe("2026-10-18");
    // shown day first, whatever the browser's own date format is
    expect(screen.getByText("01.10.2026")).toBeTruthy();
    expect(screen.getByText("18.10.2026")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Tekst/), { target: { value: "Magacin" } });
    expect(screen.getByText("Magacin · 01.10.2026 – 18.10.2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Napravi popis" }));
    await screen.findByText("OTVOREN nov");
    expect(inventoryStore.create).toHaveBeenCalledWith({ title: "Magacin", dateFrom: "2026-10-01", dateTo: "2026-10-18" });
  });

  it("won't create a popis that ends before it starts", async () => {
    inventoryStore.list.mockResolvedValue([]);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Novi popis/ }));
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Napravi popis" }));
    expect(screen.getByText(/ne može biti pre/)).toBeTruthy();
    expect(inventoryStore.create).not.toHaveBeenCalled();
  });

  it("deletes a popis after a confirmation that says how many items go with it", async () => {
    inventoryStore.list.mockResolvedValueOnce([popis("a", 12, "Magacin")]).mockResolvedValue([]);
    inventoryStore.remove.mockResolvedValue();
    setup();
    await longPress(await screen.findByText("Magacin · 01.10.2026 – 18.10.2026"));
    expect(screen.getByText("Obrisati popis „Magacin · 01.10.2026 – 18.10.2026“?")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText(/Briše se i 12 stavki/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Obriši popis" }));
    await waitFor(() => expect(inventoryStore.remove).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(screen.queryByText("Magacin · 01.10.2026 – 18.10.2026")).toBeNull());
  });

  it("offers to try again when a popis can't be deleted", async () => {
    inventoryStore.list.mockResolvedValue([popis("a", 2, "Magacin")]);
    inventoryStore.remove.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce();
    setup();
    await longPress(await screen.findByText("Magacin · 01.10.2026 – 18.10.2026"));
    fireEvent.click(screen.getByRole("button", { name: "Obriši popis" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ponovi" }));
    await waitFor(() => expect(inventoryStore.remove).toHaveBeenCalledTimes(2));
  });

  it("opens a popis with the next tap after a long press was let go", async () => {
    inventoryStore.list.mockResolvedValue([popis("a", 2, "Magacin")]);
    setup();
    const card = await screen.findByText("Magacin · 01.10.2026 – 18.10.2026");
    await longPress(card);
    fireEvent.click(screen.getByRole("button", { name: "Zadrži" }));
    // the long press ended on the sheet, so no click reached the card
    fireEvent.pointerDown(card, { clientX: 5, clientY: 5 });
    fireEvent.pointerUp(card);
    fireEvent.click(card);
    expect(await screen.findByText("OTVOREN a")).toBeTruthy();
  });

  it("offers to try again when the popisi can't be loaded", async () => {
    inventoryStore.list.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValue([popis("a", 0, "Magacin")]);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Pokušaj ponovo" }));
    expect(await screen.findByText("Magacin · 01.10.2026 – 18.10.2026")).toBeTruthy();
  });
});
