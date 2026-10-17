// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import Scan from "./Scan.jsx";
import { createDetector } from "../lib/scanner.js";

vi.mock("../lib/scanner.js", async (importOriginal) => ({
  ...(await importOriginal()),
  startCamera: vi.fn(async () => ({ deviceId: "cam", torch: false, setTorch: () => {}, stop: () => {} })),
  createDetector: vi.fn(),
}));

beforeAll(() => {
  vi.stubGlobal("requestAnimationFrame", (cb) => setTimeout(() => cb(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id) => clearTimeout(id));
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
});
afterEach(() => {
  delete window.BarcodeDetector;
  vi.mocked(createDetector).mockReset();
});

// act() holds React updates until it returns, so wait in short steps.
const frames = async (ms) => {
  for (let waited = 0; waited < ms; waited += 20) await act(() => new Promise((r) => setTimeout(r, 20)));
};

const setup = () =>
  render(
    <MemoryRouter initialEntries={["/", "/skeniranje"]} initialIndex={1}>
      <ToastProvider>
        <Routes>
          <Route path="/skeniranje" element={<Scan editor={{ barcode: null, open: vi.fn(), close: vi.fn() }} />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

describe("Scan when the barcode reader can't work", () => {
  it("says so and offers manual entry when the reader fails to load", async () => {
    vi.mocked(createDetector).mockRejectedValue(new Error("wasm failed"));
    setup();
    await frames(100);
    expect(screen.getByRole("status").textContent).toContain("Čitač barkoda nije dostupan.");
    expect(screen.getByText("Upiši ručno")).toBeTruthy();
  });

  it("switches to zxing when the built-in reader keeps failing", async () => {
    window.BarcodeDetector = class {};
    vi.mocked(createDetector).mockImplementation(async (kind) =>
      kind === "native"
        ? { detect: async () => Promise.reject(new Error("service unavailable")) }
        : { detect: async () => [] }
    );
    setup();
    await frames(1000);
    expect(vi.mocked(createDetector).mock.calls.map(([kind]) => kind)).toEqual(["native", "zxing"]);
  });
});
