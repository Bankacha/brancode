import { afterEach } from "vitest";

// jsdom has no PointerEvent, so pointer events would lose clientX/clientY;
// a MouseEvent subclass is enough for the gestures under test.
if (typeof window !== "undefined" && typeof window.PointerEvent === "undefined") {
  window.PointerEvent = class PointerEvent extends window.MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  };
}

// Unmount rendered components between tests; node-only test files have no DOM.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
