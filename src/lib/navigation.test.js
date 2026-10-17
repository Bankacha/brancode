import { describe, it, expect } from "vitest";
import { finishScreen, leaveScreen, openSheetOverHome } from "./navigation.js";

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

describe("openSheetOverHome", () => {
  it("turns an in-app camera/manual entry into home with the sheet, so back closes the sheet and a second back leaves", () => {
    const calls = [];
    openSheetOverHome((...args) => calls.push(args), { key: "k3x9a" }, "edit");
    expect(calls).toEqual([["/", { replace: true, state: { sheet: "edit" } }]]);
  });

  it("puts home under the sheet when the screen was the first page loaded", () => {
    const calls = [];
    openSheetOverHome((...args) => calls.push(args), { key: "default" }, "edit");
    expect(calls).toEqual([
      ["/", { replace: true }],
      ["/", { state: { sheet: "edit" } }],
    ]);
  });
});

describe("finishScreen", () => {
  it("steps back past the sheet and the screen to the page behind them", () => {
    const calls = [];
    finishScreen((...args) => calls.push(args), false);
    expect(calls).toEqual([[-2]]);
  });

  it("goes home when the screen was the first page loaded", () => {
    const calls = [];
    finishScreen((...args) => calls.push(args), true);
    expect(calls).toEqual([["/", { replace: true }]]);
  });
});

