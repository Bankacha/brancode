import { describe, it, expect } from "vitest";
import { parseStoredQueue, upsertQueueItem, withoutItem, withItemRestored } from "./printQueue.js";

describe("parseStoredQueue", () => {
  it("keeps a list saved by the current app version", () => {
    const saved = [
      { id: "a-1", barcode: "8600005000122", name: "MAJONEZ 175", price: 84 },
      { id: "b-2", barcode: "123", name: "X", price: 10, notInDb: true },
    ];
    expect(parseStoredQueue(JSON.stringify(saved))).toEqual(saved);
  });

  it("starts empty when nothing usable is stored", () => {
    expect(parseStoredQueue(null)).toEqual([]);
    expect(parseStoredQueue("{oops")).toEqual([]);
    expect(parseStoredQueue('{"a":1}')).toEqual([]);
  });
});

const a = { id: "a", barcode: "1", name: "A", price: 1 };
const b = { id: "b", barcode: "2", name: "B", price: 2, notInDb: true };
const c = { id: "c", barcode: "3", name: "C", price: 3 };
const q = [a, b, c];

describe("upsertQueueItem", () => {
  it("replaces an item with the same barcode in place, keeping its id and dropping notInDb", () => {
    expect(upsertQueueItem(q, { id: "x", barcode: "2", name: "B2", price: 5 })).toEqual([
      a,
      { id: "b", barcode: "2", name: "B2", price: 5 },
      c,
    ]);
  });

  it("appends a new barcode at the end", () => {
    const item = { id: "x", barcode: "9", name: "N", price: 9 };
    expect(upsertQueueItem(q, item)).toEqual([a, b, c, item]);
  });
});

describe("withoutItem", () => {
  it("removes the item and remembers where it was", () => {
    expect(withoutItem(q, "b")).toEqual({ next: [a, c], removed: { item: b, index: 1 } });
  });

  it("reports nothing removed for an unknown id", () => {
    expect(withoutItem(q, "zz").removed).toBeNull();
  });
});

describe("withItemRestored", () => {
  it("puts the item back where it was", () => {
    expect(withItemRestored([a, c], { item: b, index: 1 })).toEqual([a, b, c]);
  });

  it("clamps the position when the list got shorter", () => {
    expect(withItemRestored([a], { item: c, index: 2 })).toEqual([a, c]);
  });

  it("does not duplicate an article that was added again meanwhile", () => {
    const again = [a, { id: "n", barcode: "2", name: "B", price: 2 }, c];
    expect(withItemRestored(again, { item: b, index: 1 })).toBe(again);
  });
});
