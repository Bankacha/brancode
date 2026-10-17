// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EditSheet from "./EditSheet.jsx";

const editor = (overrides = {}) => ({
  barcode: "8606107654321",
  name: "Hleb beli 500g",
  price: "79",
  badge: "U bazi",
  loading: false,
  saving: false,
  error: null,
  canSave: true,
  setName: vi.fn(),
  setPrice: vi.fn(),
  ...overrides,
});

const setup = (props) => render(<EditSheet open onClose={() => {}} onSave={() => {}} format="shelf" editor={editor()} {...props} />);

describe("EditSheet tag preview", () => {
  it("shows the tag as it will print on the shelf", () => {
    setup();
    expect(screen.getByText("Ovako izgleda cenovnik na rafu")).toBeTruthy();
    expect(screen.getByText("79,00")).toBeTruthy();
  });

  it("shows 0,00 while the typed price isn't a valid price yet", () => {
    setup({ editor: editor({ price: "abc", canSave: false }) });
    expect(screen.getByText("0,00")).toBeTruthy();
  });

  it("follows the chosen format", () => {
    setup({ format: "fruit" });
    expect(screen.getByText("Ovako izgleda cenovnik za voće")).toBeTruthy();
  });

describe("EditSheet actions by source", () => {
  const handlers = () => ({ onSave: vi.fn(), onSaveNext: vi.fn(), onSkip: vi.fn(), onFinish: vi.fn() });
  const found = editor({ badge: "U bazi", oldPrice: "79,00" });

  it("after a scan of a known article: quick price check, no preview, skip and finish", () => {
    const h = handlers();
    setup({ source: "scan", sessionCount: 3, editor: found, ...h });
    expect(screen.getByText("3. u nizu")).toBeTruthy();
    expect(screen.getByText("Cena · bila 79,00")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sačuvaj i skeniraj sledeći/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sačuvaj i završi (3)" })).toBeTruthy();
    expect(screen.queryByText(/Ovako izgleda cenovnik/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preskoči" }));
    expect(h.onSkip).toHaveBeenCalledTimes(1);
  });

  it("after a scan of a new article: preview, save and scan on, or save and close", () => {
    setup({ source: "scan", sessionCount: 1, editor: editor({ badge: "Novi artikal", name: "", price: "" }), ...handlers() });
    expect(screen.getByText(/Ovako izgleda cenovnik/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sačuvaj i skeniraj sledeći/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sačuvaj i zatvori" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Preskoči" })).toBeNull();
  });

  it("after manual entry: save and type the next one", () => {
    setup({ source: "manual", editor: found, ...handlers() });
    expect(screen.getByRole("button", { name: "Sačuvaj i upiši sledeći" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sačuvaj i zatvori" })).toBeTruthy();
  });

  it("from the list: just save and close", () => {
    const h = handlers();
    setup({ source: "list", ...h });
    expect(screen.queryByRole("button", { name: /sledeći/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj i zatvori" }));
    expect(h.onSave).toHaveBeenCalledTimes(1);
  });
});
});
