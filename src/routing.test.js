import { it, expect } from "vitest";
import vercel from "../vercel.json";

const rewrite = vercel.rewrites[0];
const served = (path) => new RegExp(`^${rewrite.source}$`).test(path);

it("serves the app for every page route", () => {
  for (const path of ["/", "/skeniranje", "/rucni-unos", "/pregled"]) expect(served(path)).toBe(true);
  expect(rewrite.destination).toBe("/index.html");
});

it("never rewrites the email endpoint", () => {
  expect(served("/api/send-email")).toBe(false);
});
