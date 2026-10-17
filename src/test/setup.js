import { afterEach } from "vitest";

// Unmount rendered components between tests; node-only test files have no DOM.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
