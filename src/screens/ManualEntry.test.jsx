// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import ManualEntry from "./ManualEntry.jsx";

const editor = () => ({
  barcode: null, name: "", price: "", badge: null, oldPrice: null, loading: false, saving: false, error: null, canSave: false,
  open: vi.fn(), setName: vi.fn(), setPrice: vi.fn(), save: vi.fn(), skip: vi.fn(), close: vi.fn(),
});

const setup = (ed = editor()) => {
  render(
    <MemoryRouter initialEntries={["/", "/rucni-unos"]} initialIndex={1}>
      <ToastProvider>
        <ManualEntry editor={ed} />
      </ToastProvider>
    </MemoryRouter>
  );
  return ed;
};
const press = (label) => fireEvent.click(screen.getByRole("button", { name: label }));

describe("ManualEntry", () => {
  it("builds the code from the keypad and counts the digits", () => {
    setup();
    for (const d of ["8", "6", "0"]) press(d);
    expect(screen.getByTestId("code").textContent).toBe("860");
    expect(screen.getByText("3 od 13 cifara · EAN, UPC ili interna šifra")).toBeTruthy();
    press("Obriši");
    expect(screen.getByTestId("code").textContent).toBe("86");
  });

  it("looks the code up when continuing", () => {
    const ed = setup();
    expect(screen.getByRole("button", { name: "Nastavi" }).disabled).toBe(true);
    for (const d of ["8", "6", "0"]) press(d);
    press("Nastavi");
    expect(ed.open).toHaveBeenCalledWith("860");
  });

  it("accepts typing on a physical keyboard", () => {
    setup();
    fireEvent.keyDown(window, { key: "4" });
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(screen.getByTestId("code").textContent).toBe("4");
  });
});
