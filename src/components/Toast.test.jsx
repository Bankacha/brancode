// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "./Toast.jsx";

function Trigger({ toast }) {
  const { show } = useToast();
  return <button onClick={() => show(toast)}>show {toast.text}</button>;
}

const setup = (...toasts) =>
  render(
    <ToastProvider>
      {toasts.map((t) => (
        <Trigger key={t.text} toast={t} />
      ))}
    </ToastProvider>
  );

describe("ToastProvider", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("hides a success status after 2.5 s", () => {
    setup({ kind: "success", text: "Dodato: A" });
    fireEvent.click(screen.getByText("show Dodato: A"));
    expect(screen.getByRole("status").textContent).toContain("Dodato: A");
    act(() => vi.advanceTimersByTime(2500));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps an error until it is dealt with", () => {
    setup({ kind: "error", text: "Nema veze. Nije sačuvano." });
    fireEvent.click(screen.getByText("show Nema veze. Nije sačuvano."));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole("status").textContent).toContain("Nema veze. Nije sačuvano.");
  });

  it("replaces the current status with a new one", () => {
    setup({ kind: "loading", text: "Čitam liflet…" }, { kind: "success", text: "Uvezeno" });
    fireEvent.click(screen.getByText("show Čitam liflet…"));
    fireEvent.click(screen.getByText("show Uvezeno"));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toContain("Uvezeno");
  });

  it("runs the action once and hides", () => {
    const run = vi.fn();
    setup({ kind: "success", text: "Uklonjeno: A", duration: 4000, action: { label: "Vrati", run } });
    fireEvent.click(screen.getByText("show Uklonjeno: A"));
    fireEvent.click(screen.getByText("Vrati"));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
