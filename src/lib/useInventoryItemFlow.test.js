// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInventoryItemFlow } from "./useInventoryItemFlow.js";
import { inventoryStore } from "./inventories.js";
import { lookupArticle } from "./products.js";

vi.mock("./inventories.js", () => ({
  inventoryStore: { findItem: vi.fn(), addItem: vi.fn(), addQuantity: vi.fn(), updateItem: vi.fn() },
}));
vi.mock("./products.js", () => ({ lookupArticle: vi.fn() }));

const onList = { id: "it1", barcode: "8600005000122", name: "MAJONEZ 175", price: 85, quantity: 2, inProducts: true };
const flowFor = () => renderHook(() => useInventoryItemFlow("p1")).result;

describe("useInventoryItemFlow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fills and locks name and price for an article from the database, keeping its full code", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: 85 });
    const flow = flowFor();
    await act(() => flow.current.start("860000500012"));
    expect(flow.current.state).toMatchObject({ kind: "new", barcode: "8600005000122", name: "MAJONEZ 175", price: "85", quantity: "", locked: true });
  });

  it("leaves name and price to type for an article that isn't in the database", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue(null);
    const flow = flowFor();
    await act(() => flow.current.start("12345"));
    expect(flow.current.state).toMatchObject({ kind: "new", barcode: "12345", name: "", price: "", locked: false });
  });

  it("asks what to do when the article is already on the popis", async () => {
    inventoryStore.findItem.mockResolvedValue(onList);
    const flow = flowFor();
    await act(() => flow.current.start("8600005000122"));
    expect(flow.current.state).toEqual({ kind: "duplicate", item: onList });
    expect(lookupArticle).not.toHaveBeenCalled();
  });

  it("adds a counted quantity in the database", async () => {
    inventoryStore.findItem.mockResolvedValue(onList);
    inventoryStore.addQuantity.mockResolvedValue({ ...onList, quantity: 3.5 });
    const flow = flowFor();
    await act(() => flow.current.start("8600005000122"));
    act(() => flow.current.chooseAdd());
    act(() => flow.current.setField("amount", "1,5"));
    let result;
    await act(async () => (result = await flow.current.save()));
    expect(inventoryStore.addQuantity).toHaveBeenCalledWith("it1", 1.5);
    expect(result).toMatchObject({ ok: true, action: "added-quantity", item: { quantity: 3.5 } });
    expect(flow.current.state.kind).toBe("idle");
  });

  it("saves a new item with its quantity, zero allowed", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue(null);
    inventoryStore.addItem.mockResolvedValue({ item: { id: "n1" } });
    const flow = flowFor();
    await act(() => flow.current.start("12345"));
    act(() => flow.current.setField("name", " Hleb "));
    act(() => flow.current.setField("price", "79,50"));
    act(() => flow.current.setField("quantity", "0"));
    let result;
    await act(async () => (result = await flow.current.save()));
    expect(inventoryStore.addItem).toHaveBeenCalledWith("p1", { barcode: "12345", name: "Hleb", price: 79.5, quantity: 0, inProducts: false });
    expect(result).toMatchObject({ ok: true, action: "added" });
  });

  it("turns to the duplicate question when another phone added it first", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: 85 });
    inventoryStore.addItem.mockResolvedValue({ duplicate: onList });
    const flow = flowFor();
    await act(() => flow.current.start("8600005000122"));
    act(() => flow.current.setField("quantity", "4"));
    let result;
    await act(async () => (result = await flow.current.save()));
    expect(result).toEqual({ ok: false, reason: "duplicate" });
    expect(flow.current.state).toEqual({ kind: "duplicate", item: onList });
  });

  it("refuses a missing name or price and a quantity that isn't one, without saving", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue(null);
    const flow = flowFor();
    await act(() => flow.current.start("12345"));
    act(() => flow.current.setField("quantity", "-1"));
    let result;
    await act(async () => (result = await flow.current.save()));
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(Object.keys(flow.current.state.errors).sort()).toEqual(["name", "price", "quantity"]);
    expect(inventoryStore.addItem).not.toHaveBeenCalled();
  });

  it("edits an item on the list without touching its barcode", async () => {
    inventoryStore.updateItem.mockResolvedValue({ ...onList, quantity: 7 });
    const flow = flowFor();
    act(() => flow.current.edit(onList));
    expect(flow.current.state).toMatchObject({ kind: "edit", quantity: "2", locked: true });
    act(() => flow.current.setField("quantity", "7"));
    await act(() => flow.current.save());
    expect(inventoryStore.updateItem).toHaveBeenCalledWith("it1", { name: "MAJONEZ 175", price: 85, quantity: 7 });
  });

  it("keeps what was typed when there is no connection", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue(null);
    inventoryStore.addItem.mockRejectedValue(new Error("Failed to fetch"));
    const flow = flowFor();
    await act(() => flow.current.start("12345"));
    act(() => flow.current.setField("name", "Hleb"));
    act(() => flow.current.setField("price", "80"));
    act(() => flow.current.setField("quantity", "3"));
    let result;
    await act(async () => (result = await flow.current.save()));
    expect(result).toEqual({ ok: false, reason: "network" });
    expect(flow.current.state).toMatchObject({ kind: "new", name: "Hleb", quantity: "3" });
  });

  it("reports a failed lookup so the screen can offer to retry", async () => {
    inventoryStore.findItem.mockRejectedValue(new Error("Failed to fetch"));
    const flow = flowFor();
    let result;
    await act(async () => (result = await flow.current.start("12345")));
    expect(result).toEqual({ ok: false, reason: "network" });
    expect(flow.current.state.kind).toBe("idle");
  });
});
