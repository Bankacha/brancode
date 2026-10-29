// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import { SessionProvider } from "../auth/session.jsx";
import Home from "./Home.jsx";
import { supabase } from "../supabaseClient";
import { parseLeafletPdf } from "../promoLeaflet.js";
import { findSameLeaflet, importLeaflet } from "../lib/leafletImport.js";

vi.mock("../supabaseClient", () => ({ supabase: { auth: { signOut: vi.fn(async () => ({ error: null })) } } }));
vi.mock("../lib/leafletImport.js", () => ({
  findSameLeaflet: vi.fn(async () => null),
  importLeaflet: vi.fn(async () => ({ applied: true })),
}));
vi.mock("../promoLeaflet.js", () => ({
  parseLeafletPdf: vi.fn(),
  matchLeafletRows: vi.fn(async (rows) => rows.map((row) => ({ ...row, existing: null }))),
}));

const item = (i, notInDb = false) => ({ id: `i${i}`, barcode: `860000000${String(i).padStart(4, "0")}`, name: `Artikal ${i}`, price: 100 + i, ...(notInDb && { notInDb }) });
const list = (n, notInDb = 0) => Array.from({ length: n }, (_, i) => item(i, i < notInDb));

function Harness({ initial }) {
  const [queue, setQueue] = useState(initial);
  return (
    <SessionProvider value={{ user: { email: "b@b.com" } }}>
      <MemoryRouter>
        <ToastProvider>
          <Home queue={queue} setQueue={setQueue} editor={{ openItem: vi.fn() }} />
        </ToastProvider>
      </MemoryRouter>
    </SessionProvider>
  );
}

const names = () => screen.queryAllByText(/^Artikal \d+$/).map((el) => el.textContent);

describe("Home", () => {
  it("counts tags and groups the ones that need checking", () => {
    render(<Harness initial={list(7, 2)} />);
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("cena")).toBeTruthy();
    expect(screen.getByText("2 traže proveru pre štampe")).toBeTruthy();
    expect(screen.getByText("Za proveru · nije u bazi")).toBeTruthy();
    expect(screen.getByText("Spremno · 5")).toBeTruthy();
  });

  it("shows the logo at the top instead of the app's name", () => {
    render(<Harness initial={[]} />);
    expect(screen.getByRole("img", { name: "Brancode" })).toBeTruthy();
    expect(screen.queryByText("brancode")).toBeNull();
  });

  it("says everything is ready when nothing needs checking", () => {
    render(<Harness initial={list(1)} />);
    expect(screen.getByText("cena")).toBeTruthy();
    expect(screen.getByText("Sve je spremno za štampu")).toBeTruthy();
    expect(screen.queryByText("Za proveru · nije u bazi")).toBeNull();
  });

  it("uses singular forms for 21 tags and 1 to check", () => {
    render(<Harness initial={list(21, 1)} />);
    expect(screen.getByText("21")).toBeTruthy();
    expect(screen.getByText("cena")).toBeTruthy();
    expect(screen.getByText("1 traži proveru pre štampe")).toBeTruthy();
  });

  it("counts 2 to 4 as cene", () => {
    render(<Harness initial={list(22)} />);
    expect(screen.getByText("cene")).toBeTruthy();
  });

  it("asks before deleting a single price as 1 cenu", () => {
    render(<Harness initial={list(1)} />);
    fireEvent.click(screen.getByRole("button", { name: "Obriši sve" }));
    expect(screen.getByText("Obrisati 1 cenu?")).toBeTruthy();
  });

  it("invites the first scan when the list is empty", () => {
    render(<Harness initial={[]} />);
    expect(screen.getByText("Skeniraj prvi artikal")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Pregled/ }).disabled).toBe(true);
  });

  it("signs out from the menu", () => {
    render(<Harness initial={list(2)} />);
    fireEvent.click(screen.getByRole("button", { name: "Meni" }));
    expect(screen.getByText("b@b.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Odjavi se/ }));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("removes a row with X and puts it back in place with Vrati", () => {
    render(<Harness initial={list(3)} />);
    const second = screen.getByText("Artikal 1").closest("li");
    fireEvent.click(within(second).getByRole("button", { name: "Ukloni" }));
    expect(names()).toEqual(["Artikal 0", "Artikal 2"]);
    expect(screen.getByRole("status").textContent).toContain("Uklonjeno: Artikal 1");
    fireEvent.click(screen.getByText("Vrati"));
    expect(names()).toEqual(["Artikal 0", "Artikal 1", "Artikal 2"]);
  });

  it("offers Obriši sve on the first group, even when every article still needs checking", () => {
    render(<Harness initial={list(3, 3)} />);
    fireEvent.click(screen.getByRole("button", { name: "Obriši sve" }));
    expect(screen.getByText("Obrisati sve 3 cene?")).toBeTruthy();
  });

  it("shows Obriši sve only once, on the first group", () => {
    render(<Harness initial={list(4, 2)} />);
    expect(screen.getAllByRole("button", { name: "Obriši sve" })).toHaveLength(1);
  });

  it("counts every printed copy, but groups count rows", () => {
    render(<Harness initial={[{ ...item(0), copies: 3 }, item(1)]} />);
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("cene")).toBeTruthy();
    expect(screen.getByText("Spremno · 2")).toBeTruthy();
    expect(within(screen.getByText("Artikal 0").closest("li")).getByText("×3")).toBeTruthy();
    expect(within(screen.getByText("Artikal 1").closest("li")).queryByText(/×/)).toBeNull();
  });

  it("brings a removed row back with its copies", () => {
    render(<Harness initial={[{ ...item(0), copies: 3 }, item(1)]} />);
    fireEvent.click(within(screen.getByText("Artikal 0").closest("li")).getByRole("button", { name: "Ukloni" }));
    expect(screen.getByText("1")).toBeTruthy();
    fireEvent.click(screen.getByText("Vrati"));
    expect(screen.getByText("4")).toBeTruthy();
    expect(within(screen.getByText("Artikal 0").closest("li")).getByText("×3")).toBeTruthy();
  });

  it("asks to clear as many tags as the counter shows", () => {
    render(<Harness initial={[{ ...item(0), copies: 3 }, item(1)]} />);
    fireEvent.click(screen.getByRole("button", { name: "Obriši sve" }));
    expect(screen.getByText("Obrisati sve 4 cene?")).toBeTruthy();
  });

  it("marks an article from a leaflet with the promotion's last day", () => {
    render(<Harness initial={[{ ...item(0), promo: { dateFrom: "2026-09-25", dateTo: "2026-10-31" } }, item(1)]} />);
    expect(within(screen.getByText("Artikal 0").closest("li")).getByText(/akcija do 31\.10\./)).toBeTruthy();
    expect(within(screen.getByText("Artikal 1").closest("li")).queryByText(/akcija/)).toBeNull();
  });

  it("shows the dates of the leaflet just picked, after another one was cancelled", async () => {
    const rows = [{ ean: "8600000000017", name: "A", price: 1 }];
    vi.mocked(parseLeafletPdf)
      .mockResolvedValueOnce({ rows, period: { name: "Oktobar", dateFrom: "2026-09-25", dateTo: "2026-10-31" } })
      .mockResolvedValueOnce({ rows, period: { name: "Novembar", dateFrom: "2026-11-01", dateTo: "2026-11-30" } });
    const { container } = render(<Harness initial={[]} />);
    const input = container.querySelector('input[type="file"]');
    const pdf = (name) => ({ name, arrayBuffer: async () => new ArrayBuffer(1) }); // jsdom's File has no arrayBuffer
    fireEvent.change(input, { target: { files: [pdf("oktobar.pdf")] } });
    expect(await screen.findByText("31.10.2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Otkaži" }));
    fireEvent.change(input, { target: { files: [pdf("novembar.pdf")] } });
    expect(await screen.findByText("novembar.pdf")).toBeTruthy();
    expect(screen.getByText("30.11.2026")).toBeTruthy();
    expect(screen.queryByText("31.10.2026")).toBeNull();
  });

  it("asks whether a leaflet is the same one with corrected dates, and imports onto it", async () => {
    const rows = [{ ean: "8600000000017", name: "A", price: 1 }];
    vi.mocked(parseLeafletPdf).mockResolvedValueOnce({ rows, period: { name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2099-11-02" } });
    vi.mocked(findSameLeaflet).mockResolvedValueOnce({ id: "L1", name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2099-10-31" });
    vi.mocked(importLeaflet).mockClear();
    const { container } = render(<Harness initial={[]} />);
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [{ name: "liflet.pdf", arrayBuffer: async () => new ArrayBuffer(1) }] } });
    fireEvent.click(await screen.findByRole("button", { name: "Uvezi u listu" }));
    fireEvent.click(await screen.findByRole("button", { name: "Da, ispravi datume" }));
    await waitFor(() => expect(importLeaflet).toHaveBeenCalledTimes(1));
    expect(vi.mocked(importLeaflet).mock.calls[0][1]).toMatchObject({ dateFrom: "2026-09-25", dateTo: "2099-11-02", replaceId: "L1" });
  });

  it("asks again with the dates as changed after the question", async () => {
    const rows = [{ ean: "8600000000017", name: "A", price: 1 }];
    vi.mocked(parseLeafletPdf).mockResolvedValueOnce({ rows, period: { name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2099-11-02" } });
    vi.mocked(findSameLeaflet).mockResolvedValueOnce({ id: "L1", name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2099-10-31" });
    vi.mocked(findSameLeaflet).mockClear();
    const { container } = render(<Harness initial={[]} />);
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [{ name: "liflet.pdf", arrayBuffer: async () => new ArrayBuffer(1) }] } });
    fireEvent.click(await screen.findByRole("button", { name: "Uvezi u listu" }));
    await screen.findByRole("button", { name: "Da, ispravi datume" });
    fireEvent.change(screen.getByLabelText("Akcija do"), { target: { value: "2099-11-05" } });
    expect(screen.queryByRole("button", { name: "Da, ispravi datume" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Uvezi u listu" }));
    await waitFor(() => expect(findSameLeaflet).toHaveBeenCalledTimes(2));
    expect(vi.mocked(findSameLeaflet).mock.calls[1][1]).toMatchObject({ dateFrom: "2026-09-25", dateTo: "2099-11-05" });
  });

  it("imports at once when no leaflet looks the same", async () => {
    const rows = [{ ean: "8600000000017", name: "A", price: 1 }];
    vi.mocked(parseLeafletPdf).mockResolvedValueOnce({ rows, period: { name: "Novembar", dateFrom: "2026-11-01", dateTo: "2099-11-30" } });
    vi.mocked(importLeaflet).mockClear();
    const { container } = render(<Harness initial={[]} />);
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [{ name: "liflet.pdf", arrayBuffer: async () => new ArrayBuffer(1) }] } });
    fireEvent.click(await screen.findByRole("button", { name: "Uvezi u listu" }));
    await waitFor(() => expect(importLeaflet).toHaveBeenCalledTimes(1));
    expect(vi.mocked(importLeaflet).mock.calls[0][1].replaceId).toBeUndefined();
  });

  it("keeps clearing the list out of the menu", () => {
    render(<Harness initial={list(2)} />);
    fireEvent.click(screen.getByRole("button", { name: "Meni" }));
    expect(screen.queryByRole("button", { name: /Obriši listu/ })).toBeNull();
  });
});

