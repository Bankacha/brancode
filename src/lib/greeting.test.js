import { describe, it, expect } from "vitest";
import { greeting } from "./greeting.js";

const at = (hour, minute = 0) => new Date(2026, 9, 18, hour, minute);

describe("greeting", () => {
  it("says good morning from 5 until 11", () => {
    expect(greeting(at(5))).toBe("Dobro jutro.");
    expect(greeting(at(10, 59))).toBe("Dobro jutro.");
  });

  it("says good day from 11 until 18", () => {
    expect(greeting(at(11))).toBe("Dobar dan.");
    expect(greeting(at(17, 59))).toBe("Dobar dan.");
  });

  it("says good evening from 18, through the night, until 5", () => {
    expect(greeting(at(18))).toBe("Dobro veče.");
    expect(greeting(at(23, 30))).toBe("Dobro veče.");
    expect(greeting(at(0, 15))).toBe("Dobro veče.");
    expect(greeting(at(4, 59))).toBe("Dobro veče.");
  });
});
