import { describe, it, expect } from "vitest";
import { finishScreen, leaveScreen, putHomeBehind } from "./navigation.js";

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

describe("leaveScreen and putHomeBehind for a list's screens", () => {
  it("use the list as home", () => {
    const calls = [];
    leaveScreen((...args) => calls.push(args), { key: "default" }, "/popis/p1");
    putHomeBehind((...args) => calls.push(args), { key: "default", pathname: "/popis/p1/skeniranje", state: null }, "/popis/p1");
    expect(calls).toEqual([
      ["/popis/p1", { replace: true }],
      ["/popis/p1", { replace: true }],
      ["/popis/p1/skeniranje", { state: null }],
    ]);
  });
});

describe("finishScreen", () => {
  it("steps back past the sheet and the screen when the sheet is still open", () => {
    const calls = [];
    finishScreen((...args) => calls.push(args), true);
    expect(calls).toEqual([[-2]]);
  });

  it("steps back past just the screen when back already closed the sheet", () => {
    const calls = [];
    finishScreen((...args) => calls.push(args), false);
    expect(calls).toEqual([[-1]]);
  });
});

describe("putHomeBehind", () => {
  it("puts home under a full-screen route that was the first page loaded", () => {
    const calls = [];
    putHomeBehind((...args) => calls.push(args), { key: "default", pathname: "/skeniranje", state: null });
    expect(calls).toEqual([
      ["/", { replace: true }],
      ["/skeniranje", { state: null }],
    ]);
  });

  it("leaves the history alone when the screen was opened from inside the app", () => {
    const calls = [];
    putHomeBehind((...args) => calls.push(args), { key: "k3x9a", pathname: "/skeniranje", state: null });
    expect(calls).toEqual([]);
  });
});
