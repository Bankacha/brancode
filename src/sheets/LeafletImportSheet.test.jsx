// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LeafletImportSheet from "./LeafletImportSheet.jsx";

const matches = (n, inDb) =>
  Array.from({ length: n }, (_, i) => ({ ean: `86000000${String(i).padStart(5, "0")}`, name: `A${i}`, price: 10, existing: i < inDb ? { barcode: "x" } : null }));

const period = { name: "Jutro Liflet Avg", dateFrom: "2026-09-25", dateTo: "2026-10-31" };

const setup = (props) =>
  render(
    <LeafletImportSheet
      open
      fileName="akcija_oktobar.pdf"
      leafletName="Jutro Liflet Avg"
      matches={matches(42, 35)}
      period={period}
      today="2026-09-26"
      queueLength={7}
      saving={false}
      onClose={() => {}}
      onConfirm={() => {}}
      {...props}
    />
  );
const importButton = () => screen.getByRole("button", { name: /uvezi/i });
const dateInput = (label) => screen.getByLabelText(label);

describe("LeafletImportSheet", () => {
  it("summarises what the leaflet will do", () => {
    setup();
    expect(screen.getByText("Pročitano 42 artikla")).toBeTruthy();
    expect(screen.getByText("Jutro Liflet Avg")).toBeTruthy();
    expect(screen.getByText("akcija_oktobar.pdf")).toBeTruthy();
    expect(screen.getByText("35")).toBeTruthy();
    expect(screen.getByText("u bazi, akcijska cena do 31.10.")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("nisu u bazi, samo u listu")).toBeTruthy();
    expect(screen.getByText("Posle isteka akcije redovne cene se vraćaju same.")).toBeTruthy();
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

  it("fills the period read from the PDF and writes the prices now when it has started", () => {
    setup();
    expect(screen.getByText("25.09.2026")).toBeTruthy();
    expect(screen.getByText("31.10.2026")).toBeTruthy();
    expect(screen.getByText("Akcijske cene se upisuju u bazu odmah.")).toBeTruthy();
    expect(importButton().disabled).toBe(false);
  });

  it("asks for the dates when the PDF has none", () => {
    setup({ period: null });
    expect(screen.getByText("Datumi akcije nisu pronađeni u PDF-u. Upiši ih.")).toBeTruthy();
    expect(screen.getByText("u bazi, akcijska cena")).toBeTruthy();
    expect(importButton().disabled).toBe(true);
  });

  it("refuses an end before the start", () => {
    setup({ period: { ...period, dateTo: "2026-09-20" } });
    expect(screen.getByText("Kraj akcije ne može biti pre početka.")).toBeTruthy();
    expect(importButton().disabled).toBe(true);
  });

  it("refuses a promotion that has already ended", () => {
    setup({ today: "2026-11-01" });
    expect(screen.getByText("Ova akcija je već istekla.")).toBeTruthy();
    expect(importButton().disabled).toBe(true);
  });

  it("says when prices will be written for a promotion that starts later", () => {
    setup({ today: "2026-09-20" });
    expect(screen.getByText("Akcijske cene se upisuju u bazu 25.09.2026. ujutru.")).toBeTruthy();
    expect(importButton().disabled).toBe(false);
  });

  it("imports with the dates as corrected", () => {
    const onConfirm = vi.fn();
    setup({ onConfirm });
    fireEvent.change(dateInput("Akcija do"), { target: { value: "2026-10-30" } });
    fireEvent.click(importButton());
    expect(onConfirm).toHaveBeenCalledWith({ dateFrom: "2026-09-25", dateTo: "2026-10-30" });
  });
});
