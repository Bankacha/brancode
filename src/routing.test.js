import { it, expect } from "vitest";
import vercel from "../vercel.json";

const rewrite = vercel.rewrites[0];
const served = (path) => new RegExp(`^${rewrite.source}$`).test(path);

it("serves the app for every page route", () => {
  const lists = ["/popis", "/popis/8f923e53-23bd-4dfc-a146-2d20de764ad1/skeniranje", "/trebovanje", "/trebovanje/t1/rucni-unos"];
  for (const path of ["/", "/skeniranje", "/rucni-unos", "/pregled", ...lists]) expect(served(path)).toBe(true);
  expect(rewrite.destination).toBe("/index.html");
});

it("never rewrites the email endpoint", () => {
  expect(served("/api/send-email")).toBe(false);
});

it("tells Vercel it is a Vite app that builds into dist", () => {
  // Without this Vercel looked for a "build" folder (React Router's default)
  // and failed every deploy after react-router was added.
  expect(vercel.framework).toBe("vite");
  expect(vercel.outputDirectory).toBe("dist");
});
