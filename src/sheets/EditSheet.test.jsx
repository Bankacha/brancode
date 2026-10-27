// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
  copies: 1,
  setName: vi.fn(),
  setPrice: vi.fn(),
  setCopies: vi.fn(),
  ...overrides,
});

// Shelf prices are drawn in two pieces ("79" and a smaller ",00").
const tagPrice = (text) => (_, el) => el?.tagName === "SPAN" && el.children.length === 2 && el.textContent === text;
// The copies dialog keeps its own history entry, so the sheet needs a router.
const renderSheet = (ui) => render(ui, { wrapper: MemoryRouter });
const setup = (props) => renderSheet(<EditSheet open onClose={() => {}} onSave={() => {}} format="shelf" editor={editor()} {...props} />);

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

  it("draws the article's own Mix choice while Mix is chosen", () => {
    setup({ format: "mix", editor: editor({ mixFormat: "fridge" }) });
    expect(screen.getByText("Ovako izgleda cenovnik u frižideru")).toBeTruthy();
  });

  it("draws a shelf tag in Mix until the article has a choice", () => {
    setup({ format: "mix" });
    expect(screen.getByText("Ovako izgleda cenovnik na rafu")).toBeTruthy();
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
    renderSheet(<EditSheet open onClose={() => {}} format="shelf" source="scan" sessionCount={1} editor={editor({ loading: true, badge: null, name: "", price: "", canSave: false })} />);
    expect(screen.queryByText(/Ovako izgleda cenovnik/)).toBeNull();
  });
});

describe("EditSheet copies", () => {
  const copiesButton = () => screen.getByRole("button", { name: /Broj kopija/ });

  it("offers copies discreetly, with no count for a single tag", () => {
    setup();
    expect(copiesButton().textContent).not.toContain("×");
  });

  it("shows how many copies will print", () => {
    setup({ editor: editor({ copies: 3 }) });
    expect(copiesButton().textContent).toContain("×3");
  });

  it("sets the copies only when confirmed", () => {
    const ed = editor();
    setup({ editor: ed });
    fireEvent.click(copiesButton());
    expect(screen.getByText("Broj kopija")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Više kopija" }));
    fireEvent.click(screen.getByRole("button", { name: "Više kopija" }));
    expect(ed.setCopies).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "U redu" }));
    expect(ed.setCopies).toHaveBeenCalledWith(3);
    expect(screen.queryByText("Broj kopija")).toBeNull();
  });

  it("keeps the count between 1 and 20", () => {
    setup();
    fireEvent.click(copiesButton());
    expect(screen.getByRole("button", { name: "Manje kopija" }).disabled).toBe(true);
    for (let i = 0; i < 25; i++) fireEvent.click(screen.getByRole("button", { name: "Više kopija" }));
    expect(screen.getByRole("button", { name: "Više kopija" }).disabled).toBe(true);
    expect(screen.getByText("20")).toBeTruthy();
  });

  it("closes without a change on a tap outside", () => {
    const ed = editor();
    setup({ editor: ed });
    fireEvent.click(copiesButton());
    fireEvent.click(screen.getByRole("button", { name: "Više kopija" }));
    fireEvent.click(screen.getByRole("button", { name: "Zatvori" }));
    expect(screen.queryByText("Broj kopija")).toBeNull();
    expect(ed.setCopies).not.toHaveBeenCalled();
  });

  it("keeps the price sheet's Enter and focus away while the copies window is open", () => {
    const onSaveNext = vi.fn();
    const props = { source: "scan", sessionCount: 1, onSaveNext, onSkip: () => {}, onFinish: () => {} };
    const { rerender } = setup({ ...props, editor: editor({ loading: true, badge: null, canSave: false }) });
    fireEvent.click(copiesButton());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "U redu" }));
    rerender(<EditSheet open onClose={() => {}} format="shelf" {...props} editor={editor({ badge: "U bazi" })} />);
    const price = screen.getAllByLabelText(/Cena/).at(-1);
    expect(document.activeElement).not.toBe(price);
    fireEvent.keyDown(price, { key: "Enter" });
    expect(onSaveNext).not.toHaveBeenCalled();
  });
});
