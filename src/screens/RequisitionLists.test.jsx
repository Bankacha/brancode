// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import { SessionProvider } from "../auth/session.jsx";
import RequisitionLists from "./RequisitionLists.jsx";
import { requisitionStore } from "../lib/requisitions.js";

vi.mock("../lib/requisitions.js", () => ({ requisitionStore: { list: vi.fn(), create: vi.fn(), remove: vi.fn() } }));
vi.mock("../supabaseClient", () => ({ supabase: { auth: { signOut: vi.fn() } } }));

const treb = (id, date, itemCount = 0, title = "") => ({ id, title, date, createdAt: `${date}T08:00:00Z`, itemCount });

function Opened() {
  return <p>OTVORENO {useParams().id}</p>;
}

const setup = () =>
  render(
    <SessionProvider value={{ user: { email: "b@b.com" } }}>
      <MemoryRouter initialEntries={["/trebovanje"]}>
        <ToastProvider>
          <Routes>
            <Route path="/trebovanje" element={<RequisitionLists />} />
            <Route path="/trebovanje/:id" element={<Opened />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </SessionProvider>
  );

describe("RequisitionLists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 18, 9, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("keeps the last 20 days on top and older trebovanja under Arhiva, newest first", async () => {
    requisitionStore.list.mockResolvedValue([treb("old", "2026-09-01", 4), treb("a", "2026-10-17", 2, "Pekara"), treb("b", "2026-10-18", 1)]);
    setup();
    await screen.findByText("18.10.2026");
    const titles = screen.getAllByRole("link").map((a) => a.textContent);
    expect(titles[0]).toContain("18.10.2026");
    expect(titles[1]).toContain("Pekara 17.10.2026");
    const archive = screen.getByRole("heading", { name: "Arhiva" }).closest("section");
    expect(within(archive).getByText("01.09.2026")).toBeTruthy();
  });

  it("makes a new trebovanje for today and opens it", async () => {
    requisitionStore.list.mockResolvedValue([]);
    requisitionStore.create.mockResolvedValue(treb("novo", "2026-10-18"));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Novo trebovanje/ }));
    expect(screen.getByLabelText("Datum").value).toBe("2026-10-18");
    fireEvent.change(screen.getByLabelText(/Tekst/), { target: { value: "Pekara" } });
    expect(screen.getByText("Pekara 18.10.2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Napravi trebovanje" }));
    expect(await screen.findByText("OTVORENO novo")).toBeTruthy();
    expect(requisitionStore.create).toHaveBeenCalledWith({ title: "Pekara", date: "2026-10-18" });
  });
});
