// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useLongPress } from "./useLongPress.js";

function Row({ onLongPress }) {
  return (
    <div data-testid="row" {...useLongPress(onLongPress)}>
      <button>Ukloni</button>
    </div>
  );
}

describe("useLongPress", () => {
  let onLongPress;
  beforeEach(() => {
    vi.useFakeTimers();
    onLongPress = vi.fn();
    render(<Row onLongPress={onLongPress} />);
  });
  afterEach(() => vi.useRealTimers());

  const row = () => screen.getByTestId("row");
  const wait = (ms) => act(() => vi.advanceTimersByTime(ms));

  it("fires once after holding for 500 ms", () => {
    fireEvent.pointerDown(row(), { clientX: 10, clientY: 100 });
    wait(500);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire for a tap", () => {
    fireEvent.pointerDown(row(), { clientX: 10, clientY: 100 });
    wait(300);
    fireEvent.pointerUp(row());
    wait(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does not fire when the browser takes the gesture over for scrolling", () => {
    fireEvent.pointerDown(row(), { clientX: 10, clientY: 100 });
    fireEvent.pointerCancel(row());
    wait(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does not fire when the finger moves more than 10 px", () => {
    fireEvent.pointerDown(row(), { clientX: 10, clientY: 100 });
    fireEvent.pointerMove(row(), { clientX: 10, clientY: 130 });
    wait(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("ignores presses that start on a button inside the row", () => {
    fireEvent.pointerDown(screen.getByText("Ukloni"), { clientX: 10, clientY: 100 });
    wait(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
