// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import PrintPreview from "./PrintPreview.jsx";
import { sendSheetByEmail } from "../lib/email.js";

vi.mock("../lib/email.js", () => ({ sendSheetByEmail: vi.fn() }));
vi.mock("../lib/priceTags.js", async (importOriginal) => ({
  ...(await importOriginal()),
  buildWorkbookBuffer: vi.fn(async () => new ArrayBuffer(8)),
  sheetFilename: () => "cenovnik-raf.xlsx",
  makeBarcodeDataUrl: () => "data:image/png;base64,AAA", // jsdom has no canvas
}));

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

  it("sends the sheet only once while a send is in flight", async () => {
    vi.mocked(sendSheetByEmail).mockReset().mockReturnValue(new Promise(() => {}));
    setup(items(7));
    const send = screen.getByRole("button", { name: /Pošalji/ });
    fireEvent.click(send);
    fireEvent.click(send);
    await waitFor(() => expect(sendSheetByEmail).toHaveBeenCalledTimes(1));
    expect(send.disabled).toBe(true);
  });

  it("shows which A4 page of how many, with the format's columns", () => {
    setup(items(40));
    expect(screen.getByText("A4 · 3 kolone · strana 1 od 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voće" }));
    expect(screen.getByText("A4 · 2 kolone · strana 1 od 5")).toBeTruthy();
  });

  it("pages through a long list", () => {
    setup(items(120));
    expect(screen.getByText("A4 · 3 kolone · strana 1 od 7")).toBeTruthy();
  });

  it("draws only the pages around the one in view, so a long fruit list stays quick", () => {
    localStorage.setItem("print-format", "fruit");
    setup(items(120)); // 15 pages of 8
    expect(screen.getByText("A4 · 2 kolone · strana 1 od 15")).toBeTruthy();
    expect(screen.getAllByText("10,00")).toHaveLength(16); // page 1 and page 2
  });
});

