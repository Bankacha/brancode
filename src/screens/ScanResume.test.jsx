// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import Scan from "./Scan.jsx";

// A camera that always shows the same barcode.
vi.mock("../lib/scanner.js", async (importOriginal) => ({
  ...(await importOriginal()),
  startCamera: vi.fn(async () => ({ deviceId: "cam", torch: false, setTorch: () => {}, stop: () => {} })),
  createDetector: vi.fn(async () => ({ detect: async () => [{ rawValue: "8600005000122" }] })),
}));

beforeAll(() => {
  // jsdom's requestAnimationFrame never fires here; a 16 ms timer stands in.
  vi.stubGlobal("requestAnimationFrame", (cb) => setTimeout(() => cb(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id) => clearTimeout(id));
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
});

function SystemBack() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>system back</button>;
}

// act() holds React updates until it returns, so wait in short steps.
const frames = async (ms) => {
  for (let waited = 0; waited < ms; waited += 20) await act(() => new Promise((r) => setTimeout(r, 20)));
};

describe("Scan after a cancelled read", () => {
  it("doesn't reopen the same article while it is still in front of the camera", async () => {
    const editor = { barcode: null, open: vi.fn(), close: vi.fn() };
    render(
      <MemoryRouter initialEntries={["/", "/skeniranje"]} initialIndex={1}>
        <ToastProvider>
          <Routes>
            <Route
              path="/skeniranje"
              element={
                <>
                  <Scan editor={editor} />
                  <SystemBack />
                </>
              }
            />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );
    await frames(300);
    expect(editor.open).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("system back")); // cancel the sheet
    await frames(300);
    expect(editor.open).toHaveBeenCalledTimes(1);
  });
});
