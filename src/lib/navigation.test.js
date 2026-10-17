import { describe, it, expect } from "vitest";
import { leaveScreen } from "./navigation.js";

describe("leaveScreen", () => {
  it("goes back when the screen was opened from inside the app, so back can't reopen it", () => {
    const calls = [];
    leaveScreen((...args) => calls.push(args), { key: "k3x9a" });
    expect(calls).toEqual([[-1]]);
  });

  it("replaces with home when the screen was the first page loaded", () => {
    const calls = [];
    leaveScreen((...args) => calls.push(args), { key: "default" });
    expect(calls).toEqual([["/", { replace: true }]]);
  });
});
