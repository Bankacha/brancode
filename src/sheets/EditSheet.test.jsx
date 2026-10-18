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

// Shelf prices are drawn in two pieces ("79" and a smaller ",00").
const tagPrice = (text) => (_, el) => el?.tagName === "SPAN" && el.children.length === 2 && el.textContent === text;
const setup = (props) => render(<EditSheet open onClose={() => {}} onSave={() => {}} format="shelf" editor={editor()} {...props} />);

describe("EditSheet tag preview", () => {
  it("shows the tag as it will print on the shelf", () => {
    setup();
    expect(screen.getByText("Ovako izgleda cenovnik na rafu")).toBeTruthy();
    expect(screen.getByText(tagPrice("79,00"))).toBeTruthy();
  });

  it("shows 0,00 while the typed price isn't a valid price yet", () => {
    setup({ editor: editor({ price: "abc", canSave: false }) });
    expect(screen.getByText(tagPrice("0,00"))).toBeTruthy();
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

  it("saves from the keyboard's Enter key, without closing the keyboard first", () => {
    const h = handlers();
    setup({ source: "scan", sessionCount: 1, editor: found, ...h });
    const price = screen.getByLabelText(/Cena/);
    expect(price.getAttribute("enterkeyhint")).toBe("done");
    fireEvent.keyDown(price, { key: "Enter" });
    expect(h.onSaveNext).toHaveBeenCalledTimes(1);
  });

  it("doesn't save on an Enter that is held down or only confirms a word being typed", () => {
    const h = handlers();
    setup({ source: "scan", sessionCount: 1, editor: found, ...h });
    const price = screen.getByLabelText(/Cena/);
    fireEvent.keyDown(price, { key: "Enter", repeat: true });
    fireEvent.keyDown(price, { key: "Enter", isComposing: true });
    expect(h.onSaveNext).not.toHaveBeenCalled();
  });

  it("saves a list row from Enter too, but not while the price isn't valid", () => {
    const h = handlers();
    setup({ source: "list", ...h });
    fireEvent.keyDown(screen.getByLabelText("Naziv"), { key: "Enter" });
    expect(h.onSave).toHaveBeenCalledTimes(1);
    const blocked = handlers();
    setup({ source: "list", editor: editor({ canSave: false }), ...blocked });
    fireEvent.keyDown(screen.getAllByLabelText(/Cena/).at(-1), { key: "Enter" });
    expect(blocked.onSave).not.toHaveBeenCalled();
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

describe("EditSheet while a scanned code is looked up", () => {
  it("doesn't show the new-article preview before the database answers", () => {
    render(<EditSheet open onClose={() => {}} format="shelf" source="scan" sessionCount={1} editor={editor({ loading: true, badge: null, name: "", price: "", canSave: false })} />);
    expect(screen.queryByText(/Ovako izgleda cenovnik/)).toBeNull();
  });
});

