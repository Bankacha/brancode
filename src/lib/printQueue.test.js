import { describe, it, expect } from "vitest";
import { parseStoredQueue } from "./printQueue.js";

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
