// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import Scan from "./Scan.jsx";

vi.mock("../lib/scanner.js", async (importOriginal) => ({
  ...(await importOriginal()),
  startCamera: vi.fn(() => Promise.reject({ name: "NotAllowedError" })),
  createDetector: vi.fn(async () => ({ detect: async () => [] })),
}));

const editor = { barcode: null, name: "", price: "", badge: null, oldPrice: null, loading: false, saving: false, error: null, canSave: false, open: vi.fn(), close: vi.fn(), setName: vi.fn(), setPrice: vi.fn(), save: vi.fn(), skip: vi.fn() };

describe("Scan", () => {
  it("offers manual entry when the camera permission is refused", async () => {
    render(
      <MemoryRouter initialEntries={["/", "/skeniranje"]} initialIndex={1}>
        <ToastProvider>
          <Routes>
            <Route path="/skeniranje" element={<Scan editor={editor} />} />
            <Route path="/rucni-unos" element={<p>MANUAL</p>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Nema dozvole za kameru."));
    fireEvent.click(screen.getByText("Upiši ručno"));
    expect(screen.getByText("MANUAL")).toBeTruthy();
  });
});
