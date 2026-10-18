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

describe("BottomSheet with the on-screen keyboard open", () => {
  // jsdom has no visualViewport: a stand-in that can be resized like a
  // phone's when the keyboard comes up.
  let viewport;
  beforeEach(() => {
    viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerHeight", 844);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rises above the keyboard and fits in what is left of the screen", () => {
    render(
      <BottomSheet open onClose={() => {}}>
        <button type="button">Sačuvaj</button>
      </BottomSheet>
    );
    act(() => {
      viewport.height = 500; // a 344 px keyboard
      viewport.dispatchEvent(new Event("resize"));
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog.parentElement.style.bottom).toBe("344px");
    expect(dialog.style.maxHeight).toBe("492px");
    expect(dialog.className).toContain("overflow-y-auto");
  });

  it("goes back down when the keyboard closes", () => {
    render(
      <BottomSheet open onClose={() => {}}>
        <p>Sadržaj</p>
      </BottomSheet>
    );
    act(() => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event("resize"));
    });
    act(() => {
      viewport.height = 844;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByRole("dialog").parentElement.style.bottom).toBe("");
  });
});

describe("BottomSheet taller than the space left", () => {
  const sizes = {};
  beforeEach(() => {
    for (const key of ["scrollHeight", "clientHeight"]) sizes[key] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key);
  });
  afterEach(() => {
    for (const [key, d] of Object.entries(sizes)) {
      if (d) Object.defineProperty(HTMLElement.prototype, key, d);
      else delete HTMLElement.prototype[key];
    }
  });

  it("lets its content be scrolled by touch, so the buttons at the end can be reached", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 700 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 450 });
    render(
      <BottomSheet open onClose={() => {}}>
        <p>Dugačak sadržaj</p>
      </BottomSheet>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("touch-pan-y");
    expect(dialog.className).not.toContain("touch-none");
  });
});
