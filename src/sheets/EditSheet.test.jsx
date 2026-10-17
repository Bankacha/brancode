// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
