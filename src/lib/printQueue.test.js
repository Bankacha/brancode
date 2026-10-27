import { describe, it, expect } from "vitest";
import { copiesOf, expandCopies, mixChoice, parseStoredQueue, splitForMix, tagCount, upsertQueueItem, withCopies, withMixFormat, withoutItem, withItemRestored } from "./printQueue.js";

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

  it("brings an item back with its copies", () => {
    const tripled = { ...b, copies: 3 };
    expect(withItemRestored([a, c], { item: tripled, index: 1 })).toEqual([a, tripled, c]);
  });
});

describe("copies", () => {
  it("counts one copy when none is set", () => {
    expect(copiesOf({})).toBe(1);
    expect(copiesOf({ copies: 3 })).toBe(3);
  });

  it.each([0, -2, "3", 2.5, null])("treats a stored copies of %j as one", (copies) => {
    expect(copiesOf({ copies })).toBe(1);
  });

  it("caps copies at 20", () => {
    expect(copiesOf({ copies: 99 })).toBe(20);
  });

  it("sets copies on an item, and leaves the field out for one", () => {
    expect(withCopies(a, 3)).toEqual({ ...a, copies: 3 });
    expect("copies" in withCopies({ ...a, copies: 3 }, 1)).toBe(false);
    expect(withCopies(a, 25).copies).toBe(20);
  });

  it("counts printed tags, copies included", () => {
    expect(tagCount([a, { ...b, copies: 3 }])).toBe(4);
    expect(tagCount([])).toBe(0);
  });

  it("repeats an item one after another, with ids that stay unique", () => {
    expect(expandCopies([{ ...a, copies: 2 }, b]).map((i) => i.id)).toEqual(["a", "a#2", "b"]);
  });
});

describe("Mix", () => {
  it("starts an article without a choice on the shelf, as new", () => {
    expect(mixChoice({}, null)).toEqual({ format: "shelf", isNew: true });
  });

  it("takes the remembered format, then the phone's own choice over it", () => {
    expect(mixChoice({}, "fridge")).toEqual({ format: "fridge", isNew: false });
    expect(mixChoice({ mixFormat: "shelf" }, "fridge")).toEqual({ format: "shelf", isNew: false });
  });

  it("sets the choice on an item", () => {
    expect(withMixFormat(a, "fridge")).toEqual({ ...a, mixFormat: "fridge" });
  });

  it("splits the list by choice, in list order, keeping copies", () => {
    const tripled = { ...b, mixFormat: "fridge", copies: 3 };
    expect(splitForMix([a, tripled, c], () => null)).toEqual({ shelf: [a, c], fridge: [tripled] });
    expect(splitForMix([a, c], (item) => (item === c ? "fridge" : null))).toEqual({ shelf: [a], fridge: [c] });
  });
});
