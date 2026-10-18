import { describe, it, expect } from "vitest";
import { formatDate, formatQuantity, inventoryTitle, isArchived, monthStartIso, parseQuantity, requisitionTitle, todayIso } from "./listFormat.js";

describe("dates", () => {
  it("prints an ISO date the Serbian way", () => {
    expect(formatDate("2026-10-01")).toBe("01.10.2026");
  });

  it("gives today and the first of the month in local time", () => {
    const evening = new Date(2026, 9, 18, 23, 30);
    expect(todayIso(evening)).toBe("2026-10-18");
    expect(monthStartIso(evening)).toBe("2026-10-01");
  });
});

describe("inventoryTitle", () => {
  it("is the period, with the optional text in front", () => {
    expect(inventoryTitle({ title: "", dateFrom: "2026-10-01", dateTo: "2026-10-18" })).toBe("01.10.2026 – 18.10.2026");
    expect(inventoryTitle({ title: "  Magacin ", dateFrom: "2026-10-01", dateTo: "2026-10-18" })).toBe("Magacin · 01.10.2026 – 18.10.2026");
  });
});

describe("parseQuantity", () => {
  it("takes whole numbers and decimals with a comma or a dot", () => {
    expect(parseQuantity("12")).toBe(12);
    expect(parseQuantity("1,5")).toBe(1.5);
    expect(parseQuantity(" 0.25 ")).toBe(0.25);
    expect(parseQuantity("1,234")).toBe(1.234);
  });

  it("allows zero only where asked (a count of nothing on the shelf)", () => {
    expect(parseQuantity("0", { allowZero: true })).toBe(0);
    expect(parseQuantity("0")).toBeNull();
  });

  it("refuses what isn't a quantity", () => {
    for (const text of ["", " ", "-1", "abc", "1,2345", "1.000,5", "1e3"]) expect(parseQuantity(text, { allowZero: true })).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("prints up to three decimals, without trailing zeros", () => {
    expect(formatQuantity(12)).toBe("12");
    expect(formatQuantity(1.5)).toBe("1,5");
    expect(formatQuantity(0.125)).toBe("0,125");
    expect(formatQuantity(1500)).toBe("1.500");
  });
});

describe("requisitionTitle", () => {
  it("is the optional text followed by the date", () => {
    expect(requisitionTitle({ title: "Pekara", date: "2026-10-18" })).toBe("Pekara 18.10.2026");
    expect(requisitionTitle({ title: " ", date: "2026-10-18" })).toBe("18.10.2026");
  });
});

describe("isArchived", () => {
  const now = new Date(2026, 9, 18, 9, 0);

  it("keeps the last 20 days on top", () => {
    expect(isArchived("2026-10-18", now)).toBe(false);
    expect(isArchived("2026-09-28", now)).toBe(false); // exactly 20 days ago
  });

  it("archives older ones, across a month and a clock change", () => {
    expect(isArchived("2026-09-27", now)).toBe(true);
    expect(isArchived("2026-11-15", new Date(2026, 11, 6, 0, 30))).toBe(true); // 21 days, over the end of DST
  });
});
