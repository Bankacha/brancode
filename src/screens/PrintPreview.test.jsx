// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import PrintPreview from "./PrintPreview.jsx";

vi.mock("../lib/email.js", () => ({ sendSheetByEmail: vi.fn() }));

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, barcode: `${i}`, name: `A${i}`, price: 10 }));

const setup = (queue) =>
  render(
    <MemoryRouter initialEntries={["/", "/pregled"]} initialIndex={1}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<p>HOME</p>} />
          <Route path="/pregled" element={<PrintPreview queue={queue} />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

const pressed = (name) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

describe("PrintPreview", () => {
  beforeEach(() => localStorage.clear());

  it("shows the tag count with shelf tags chosen by default", () => {
    setup(items(7));
    expect(screen.getByText("7 kom")).toBeTruthy();
    expect(pressed("Raf")).toBe("true");
  });

  it("switches format and remembers it on this device", () => {
    setup(items(7));
    fireEvent.click(screen.getByRole("button", { name: "Voće" }));
    expect(pressed("Voće")).toBe("true");
    expect(pressed("Raf")).toBe("false");
    expect(localStorage.getItem("print-format")).toBe("fruit");
  });

  it("goes home when there is nothing to print", () => {
    setup([]);
    expect(screen.getByText("HOME")).toBeTruthy();
  });
});
