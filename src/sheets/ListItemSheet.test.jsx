// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ListItemSheet from "./ListItemSheet.jsx";
import { trebovanjeKind } from "../lib/listKinds.js";
import { savedToast } from "../screens/listToasts.js";

vi.mock("../components/BottomSheet.jsx", () => ({ default: ({ children }) => <div>{children}</div> }));

const state = (fields) => ({
  kind: "new",
  barcode: "8600005000122",
  name: "MAJONEZ 175",
  price: "85",
  quantity: "",
  lockName: false,
  lockPrice: true,
  inProducts: true,
  productBarcode: "8600005000122",
  productName: "MAJONEZ 175",
  canSaveName: true,
  saveName: false,
  errors: {},
  ...fields,
});
const sheet = (fields) => {
  const flow = { state: state(fields), setField: vi.fn() };
  render(<ListItemSheet flow={flow} texts={trebovanjeKind.texts} open onClose={() => {}} source="list" onSubmit={() => {}} />);
  return flow;
};
const box = () => screen.queryByRole("checkbox", { name: "Sačuvaj ovaj naziv i u bazi artikala" });

describe("ListItemSheet: a changed name into the database", () => {
  it("offers it once the name of a database article differs from the database's", () => {
    sheet({});
    expect(box()).toBeNull();
    const flow = sheet({ name: "Majonez za salatu" });
    expect(box().getAttribute("aria-checked")).toBe("false");
    fireEvent.click(box());
    expect(flow.setField).toHaveBeenCalledWith("saveName", true);
  });

  it("doesn't offer it for the database name with stray spaces", () => {
    sheet({ productName: " MAJONEZ 175 " });
    expect(box()).toBeNull();
  });

  it("shows it ticked", () => {
    sheet({ name: "Majonez za salatu", saveName: true });
    expect(box().getAttribute("aria-checked")).toBe("true");
  });

  it("isn't offered where the list kind doesn't allow it, or for an article not in the database", () => {
    sheet({ name: "Majonez za salatu", canSaveName: false });
    expect(box()).toBeNull();
  });
});

describe("savedToast with the name in the database", () => {
  const item = { name: "Majonez za salatu", quantity: 2 };

  it("says the name went into the database too", () => {
    expect(savedToast({ action: "updated", item, nameInProducts: "saved" })).toMatchObject({ kind: "success", text: "Izmenjeno: Majonez za salatu", detail: "2 · naziv sačuvan i u bazi" });
  });

  it("warns when only the list got it", () => {
    expect(savedToast({ action: "added", item, nameInProducts: "failed" })).toMatchObject({ kind: "error", text: "Naziv nije upisan u bazu: Majonez za salatu" });
  });
});
