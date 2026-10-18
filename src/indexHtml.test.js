import { it, expect } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

it("lets Android shrink the page above the on-screen keyboard, so sheets and their buttons stay visible", () => {
  expect(html).toMatch(/<meta name="viewport" content="[^"]*interactive-widget=resizes-content/);
});
