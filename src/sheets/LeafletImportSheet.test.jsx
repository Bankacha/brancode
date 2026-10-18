// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LeafletImportSheet from "./LeafletImportSheet.jsx";

const matches = (n, inDb) =>
  Array.from({ length: n }, (_, i) => ({ ean: `86000000${String(i).padStart(5, "0")}`, name: `A${i}`, price: 10, existing: i < inDb ? { barcode: "x" } : null }));

const setup = (props) =>
  render(<LeafletImportSheet open fileName="akcija_oktobar.pdf" matches={matches(42, 35)} queueLength={7} saving={false} onClose={() => {}} onConfirm={() => {}} {...props} />);

describe("LeafletImportSheet", () => {
  it("summarises what the leaflet will do", () => {
    setup();
    expect(screen.getByText("Pročitano 42 artikla")).toBeTruthy();
    expect(screen.getByText("akcija_oktobar.pdf")).toBeTruthy();
    expect(screen.getByText("35")).toBeTruthy();
    expect(screen.getByText("u bazi, cena se ažurira")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("nisu u bazi, samo u listu")).toBeTruthy();
  });

  it("warns that a non-empty list will be replaced", () => {
    setup();
    expect(screen.getByText(/Trenutna lista \(7\) biće zamenjena\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zameni listu i uvezi" })).toBeTruthy();
  });

  it("just imports into an empty list", () => {
    setup({ queueLength: 0 });
    expect(screen.queryByText(/biće zamenjena/)).toBeNull();
    expect(screen.getByRole("button", { name: "Uvezi u listu" })).toBeTruthy();
  });

  it("uses the singular for 21 articles", () => {
    setup({ matches: matches(21, 20) });
    expect(screen.getByText("Pročitano 21 artikal")).toBeTruthy();
  });
});
