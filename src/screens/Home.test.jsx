// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import Home from "./Home.jsx";
import { supabase } from "../supabaseClient";

vi.mock("../supabaseClient", () => ({ supabase: { auth: { signOut: vi.fn() } } }));

const item = (i, notInDb = false) => ({ id: `i${i}`, barcode: `860000000${String(i).padStart(4, "0")}`, name: `Artikal ${i}`, price: 100 + i, ...(notInDb && { notInDb }) });
const list = (n, notInDb = 0) => Array.from({ length: n }, (_, i) => item(i, i < notInDb));

function Harness({ initial }) {
  const [queue, setQueue] = useState(initial);
  return (
    <MemoryRouter>
      <ToastProvider>
        <Home queue={queue} setQueue={setQueue} editor={{ openItem: vi.fn() }} session={{ user: { email: "b@b.com" } }} />
      </ToastProvider>
    </MemoryRouter>
  );
}

const names = () => screen.queryAllByText(/^Artikal \d+$/).map((el) => el.textContent);

describe("Home", () => {
  it("counts tags and groups the ones that need checking", () => {
    render(<Harness initial={list(7, 2)} />);
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("cenovnika")).toBeTruthy();
    expect(screen.getByText("2 traže proveru pre štampe")).toBeTruthy();
    expect(screen.getByText("Za proveru · nije u bazi")).toBeTruthy();
    expect(screen.getByText("Spremno · 5")).toBeTruthy();
  });

  it("says everything is ready when nothing needs checking", () => {
    render(<Harness initial={list(1)} />);
    expect(screen.getByText("cenovnik")).toBeTruthy();
    expect(screen.getByText("Sve je spremno za štampu")).toBeTruthy();
    expect(screen.queryByText("Za proveru · nije u bazi")).toBeNull();
  });

  it("uses singular forms for 21 tags and 1 to check", () => {
    render(<Harness initial={list(21, 1)} />);
    expect(screen.getByText("21")).toBeTruthy();
    expect(screen.getByText("cenovnik")).toBeTruthy();
    expect(screen.getByText("1 traži proveru pre štampe")).toBeTruthy();
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
    expect(screen.getByText("Obrisati sva 3 cenovnika?")).toBeTruthy();
  });

  it("shows Obriši sve only once, on the first group", () => {
    render(<Harness initial={list(4, 2)} />);
    expect(screen.getAllByRole("button", { name: "Obriši sve" })).toHaveLength(1);
  });

  it("keeps clearing the list out of the menu", () => {
    render(<Harness initial={list(2)} />);
    fireEvent.click(screen.getByRole("button", { name: "Meni" }));
    expect(screen.queryByRole("button", { name: /Obriši listu/ })).toBeNull();
  });
});

