// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { SessionProvider } from "../auth/session.jsx";
import { ToastProvider } from "./Toast.jsx";
import AppMenu from "./AppMenu.jsx";
import { supabase } from "../supabaseClient";

vi.mock("../supabaseClient", () => ({ supabase: { auth: { signOut: vi.fn(async () => ({ error: null })) } } }));

function Back() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Nazad</button>;
}

const setup = (path = "/") =>
  render(
    <SessionProvider value={{ user: { email: "b@b.com" } }}>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<><p>CENOVNICI</p><Back /><AppMenu /></>} />
            <Route path="/drugo" element={<><p>DRUGO</p><Back /><AppMenu /></>} />
            <Route path="/popis" element={<><p>SPISAK POPISA</p><AppMenu /></>} />
            <Route path="/popis/:id" element={<><p>JEDAN POPIS</p><AppMenu /></>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </SessionProvider>
  );
const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Meni" }));

describe("AppMenu", () => {
  beforeEach(() => localStorage.clear());

  it("lists the sections and marks the current one", () => {
    setup();
    openMenu();
    expect(screen.getByRole("link", { name: /Cenovnici/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("b@b.com")).toBeTruthy();
  });

  it("opens settings with the temporary reader choice", () => {
    setup();
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: /Podešavanja/ }));
    fireEvent.click(screen.getByRole("button", { name: "zxing" }));
    expect(screen.getByRole("button", { name: "zxing" }).getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem("scanner-reader")).toBe("zxing");
  });

  it("chooses the PDF order for each list kind in settings", () => {
    setup();
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: /Podešavanja/ }));
    const trebovanje = screen.getByRole("group", { name: "Trebovanje" });
    expect(within(trebovanje).getByRole("button", { name: "Po nazivu" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(trebovanje).getByRole("button", { name: "Redom dodavanja" }));
    expect(JSON.parse(localStorage.getItem("pdf-order"))).toEqual({ popis: "name", trebovanje: "added" });
  });

  it("signs out", () => {
    setup();
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: /Odjavi se/ }));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("goes to a section and closes the menu", async () => {
    setup("/drugo");
    openMenu();
    fireEvent.click(screen.getByRole("link", { name: /Cenovnici/ }));
    expect(screen.getByText("CENOVNICI")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("link", { name: /Cenovnici/ })).toBeNull());
    // Back returns to the previous section, not to its open menu.
    fireEvent.click(screen.getByRole("button", { name: "Nazad" }));
    expect(screen.getByText("DRUGO")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByRole("link", { name: /Cenovnici/ })).toBeNull();
  });

  it("just closes the menu when the current section is picked", async () => {
    setup("/");
    openMenu();
    fireEvent.click(screen.getByRole("link", { name: /Cenovnici/ }));
    expect(screen.getByText("CENOVNICI")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("link", { name: /Cenovnici/ })).toBeNull());
    // No extra history entry: back doesn't bring the menu up again.
    fireEvent.click(screen.getByRole("button", { name: "Nazad" }));
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByRole("link", { name: /Cenovnici/ })).toBeNull();
  });

  it("says so when signing out fails, e.g. offline", async () => {
    supabase.auth.signOut.mockResolvedValueOnce({ error: new Error("Failed to fetch") });
    setup();
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: /Odjavi se/ }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Odjava nije uspela"));
  });

  it("marks Popis on a popis and goes to the list of popisi from there", async () => {
    setup("/popis/7");
    openMenu();
    const popis = screen.getByRole("link", { name: /Popis/ });
    expect(popis.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /Cenovnici/ }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: /Trebovanje/ }).getAttribute("href")).toBe("/trebovanje");
    fireEvent.click(popis);
    expect(await screen.findByText("SPISAK POPISA")).toBeTruthy();
  });
});
