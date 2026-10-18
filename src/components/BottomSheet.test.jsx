// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import BottomSheet from "./BottomSheet.jsx";

describe("BottomSheet on touch screens", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps a drag on the panel from turning into a page scroll", () => {
    render(
      <BottomSheet open onClose={() => {}}>
        <p>Sadržaj</p>
      </BottomSheet>
    );
    expect(screen.getByRole("dialog").className).toContain("touch-none");
  });

  it("locks page scrolling while open and restores it after closing", () => {
    const { rerender } = render(
      <BottomSheet open onClose={() => {}}>
        <p>Sadržaj</p>
      </BottomSheet>
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <BottomSheet open={false} onClose={() => {}}>
        <p>Sadržaj</p>
      </BottomSheet>
    );
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("unlocks only after the last of two overlapping sheets is gone", () => {
    const sheets = (menu, confirm) => (
      <>
        <BottomSheet open={menu} onClose={() => {}}>
          <p>Meni</p>
        </BottomSheet>
        <BottomSheet open={confirm} onClose={() => {}}>
          <p>Potvrda</p>
        </BottomSheet>
      </>
    );
    const { rerender } = render(sheets(true, false));
    rerender(sheets(false, true)); // switching: the menu fades out while the confirmation opens
    act(() => vi.advanceTimersByTime(300));
    expect(document.body.style.overflow).toBe("hidden");
    rerender(sheets(false, false));
    act(() => vi.advanceTimersByTime(300));
    expect(document.body.style.overflow).toBe("");
  });

  it("can leave what's behind visible, for the sheet over the camera", () => {
    const { container } = render(
      <BottomSheet open dim={false} onClose={() => {}}>
        <p>Sadržaj</p>
      </BottomSheet>
    );
    const backdrop = container.querySelector(".fixed > div");
    expect(backdrop.className).not.toContain("bg-scrim");
  });
});

