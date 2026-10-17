import { describe, it, expect } from "vitest";
import { shouldDismissDrag } from "./gestures.js";

describe("shouldDismissDrag", () => {
  it("closes after a long drag down", () => {
    expect(shouldDismissDrag(120, 400)).toBe(true);
  });

  it("closes after a short fast flick", () => {
    expect(shouldDismissDrag(40, 50)).toBe(true);
  });

  it("snaps back after a short slow drag or a tiny twitch", () => {
    expect(shouldDismissDrag(40, 400)).toBe(false);
    expect(shouldDismissDrag(10, 5)).toBe(false);
  });
});
