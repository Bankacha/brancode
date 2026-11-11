// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListItemFlow } from "./useListItemFlow.js";
import { popisKind, trebovanjeKind } from "./listKinds.js";
import { inventoryStore } from "./inventories.js";
import { requisitionStore } from "./requisitions.js";
import { lookupArticle, renameProduct } from "./products.js";

vi.mock("./inventories.js", () => ({
  inventoryStore: { findItem: vi.fn(), addItem: vi.fn(), addQuantity: vi.fn(), updateItem: vi.fn() },
}));
vi.mock("./requisitions.js", () => ({
  requisitionStore: { findItem: vi.fn(), addItem: vi.fn(), addQuantity: vi.fn(), updateItem: vi.fn() },
}));
vi.mock("./products.js", () => ({ lookupArticle: vi.fn(), renameProduct: vi.fn() }));

const onList = { id: "it1", barcode: "8600005000122", name: "MAJONEZ 175", price: 85, quantity: 2, inProducts: true };
const flowFor = (kind = popisKind) => renderHook(() => useListItemFlow("p1", kind)).result;

describe("useListItemFlow on a popis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fills and locks name and price for an article from the database, keeping its full code", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: 85 });
    const flow = flowFor();
    await act(() => flow.current.start("860000500012"));
    expect(flow.current.state).toMatchObject({ kind: "new", barcode: "8600005000122", name: "MAJONEZ 175", price: "85", quantity: "", lockName: true, lockPrice: true });
  });

  it("keeps the full code for 7 typed digits of an article stored with 8", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue({ barcode: "80052760", name: "KINDER BUENO", price: 99.99 });
    const flow = flowFor();
    await act(() => flow.current.start("8005276"));
    expect(flow.current.state).toMatchObject({ kind: "new", barcode: "80052760" });
  });

  it("leaves name and price to type for an article that isn't in the database", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue(null);
    const flow = flowFor();
    await act(() => flow.current.start("12345"));
    expect(flow.current.state).toMatchObject({ kind: "new", barcode: "12345", name: "", price: "", lockName: false, lockPrice: false });
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
    expect(flow.current.state).toMatchObject({ kind: "edit", quantity: "2", lockName: true, lockPrice: true });
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

  it("ignores a lookup that finishes after it was cancelled and another code started", async () => {
    let finishFirst;
    inventoryStore.findItem.mockImplementationOnce(() => new Promise((r) => (finishFirst = r))).mockResolvedValueOnce(null);
    lookupArticle.mockResolvedValue({ barcode: "222", name: "DRUGI", price: 10 });
    const flow = flowFor();
    let first;
    act(() => {
      first = flow.current.start("111");
    });
    act(() => flow.current.cancel());
    await act(() => flow.current.start("222"));
    await act(async () => {
      finishFirst(onList);
      await first;
    });
    expect(flow.current.state).toMatchObject({ kind: "new", barcode: "222", name: "DRUGI" });
  });

  it("lets the price be typed for a database article that has none", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: null });
    inventoryStore.addItem.mockResolvedValue({ item: { id: "n1", name: "MAJONEZ 175", quantity: 1 } });
    const flow = flowFor();
    await act(() => flow.current.start("8600005000122"));
    expect(flow.current.state).toMatchObject({ price: "", lockName: true, lockPrice: false });
    act(() => flow.current.setField("price", "90"));
    act(() => flow.current.setField("quantity", "1"));
    let result;
    await act(async () => (result = await flow.current.save()));
    expect(result.ok).toBe(true);
    expect(inventoryStore.addItem).toHaveBeenCalledWith("p1", expect.objectContaining({ price: 90, inProducts: true }));
  });

  it("does nothing when a retry comes after the sheet was cancelled", async () => {
    const flow = flowFor();
    let result;
    await act(async () => (result = await flow.current.save()));
    expect(result).toEqual({ ok: false, reason: "cancelled" });
  });

  it("says when the popis itself was deleted on another phone", async () => {
    inventoryStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue(null);
    inventoryStore.addItem.mockResolvedValue({ listGone: true });
    const flow = flowFor();
    await act(() => flow.current.start("12345"));
    act(() => flow.current.setField("name", "Hleb"));
    act(() => flow.current.setField("price", "80"));
    act(() => flow.current.setField("quantity", "1"));
    let result;
    await act(async () => (result = await flow.current.save()));
    expect(result).toEqual({ ok: false, reason: "list-gone" });
    expect(flow.current.state.kind).toBe("idle");
  });
});

describe("useListItemFlow on a trebovanje", () => {
  beforeEach(() => vi.clearAllMocks());
  const flowFor = () => renderHook(() => useListItemFlow("t1", trebovanjeKind)).result;
  const save = async (flow) => {
    let result;
    await act(async () => (result = await flow.current.save()));
    return result;
  };

  it("needs only a name: price and quantity may stay empty", async () => {
    requisitionStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue(null);
    requisitionStore.addItem.mockResolvedValue({ item: { id: "r1", name: "Mleko", quantity: null } });
    const flow = flowFor();
    await act(() => flow.current.start("12345"));
    act(() => flow.current.setField("name", "Mleko"));
    expect(await save(flow)).toMatchObject({ ok: true, action: "added" });
    expect(requisitionStore.addItem).toHaveBeenCalledWith("t1", { barcode: "12345", name: "Mleko", price: null, quantity: null, inProducts: false });
  });

  it("refuses an empty name, a zero quantity and a price that isn't one", async () => {
    requisitionStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue(null);
    const flow = flowFor();
    await act(() => flow.current.start("12345"));
    act(() => flow.current.setField("quantity", "0"));
    act(() => flow.current.setField("price", "abc"));
    expect(await save(flow)).toEqual({ ok: false, reason: "invalid" });
    expect(Object.keys(flow.current.state.errors).sort()).toEqual(["name", "price", "quantity"]);
  });

  it("adds an item with just a name and no barcode", async () => {
    requisitionStore.addItem.mockResolvedValue({ item: { id: "r2", name: "Hleb za sendviče", quantity: 4 } });
    const flow = flowFor();
    act(() => flow.current.startWithoutBarcode());
    expect(flow.current.state).toMatchObject({ kind: "new", barcode: null, lockName: false, lockPrice: false });
    act(() => flow.current.setField("name", "Hleb za sendviče"));
    act(() => flow.current.setField("quantity", "4"));
    await save(flow);
    expect(requisitionStore.addItem).toHaveBeenCalledWith("t1", { barcode: null, name: "Hleb za sendviče", price: null, quantity: 4, inProducts: false });
    expect(requisitionStore.findItem).not.toHaveBeenCalled();
  });

  it("edits an item without price or quantity, keeping the fields empty", async () => {
    requisitionStore.updateItem.mockResolvedValue({ id: "r3", name: "Jaja", price: null, quantity: 30 });
    const flow = flowFor();
    act(() => flow.current.edit({ id: "r3", barcode: null, name: "Jaja", price: null, quantity: null }));
    expect(flow.current.state).toMatchObject({ price: "", quantity: "" });
    act(() => flow.current.setField("quantity", "30"));
    await save(flow);
    expect(requisitionStore.updateItem).toHaveBeenCalledWith("r3", { name: "Jaja", price: null, quantity: 30 });
  });

  it("lets the name of a scanned database article be changed, keeping its price locked", async () => {
    requisitionStore.findItem.mockResolvedValue(null);
    lookupArticle.mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: 85 });
    const flow = flowFor();
    await act(() => flow.current.start("8600005000122"));
    expect(flow.current.state).toMatchObject({ kind: "new", name: "MAJONEZ 175", lockName: false, lockPrice: true, inProducts: true });
  });

  it("locks a database article's price on edit too, looking it up since trebovanje doesn't store that", async () => {
    lookupArticle.mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: 85 });
    const flow = flowFor();
    let result;
    await act(async () => (result = await flow.current.edit({ id: "r4", barcode: "8600005000122", name: "Majonez za salatu", price: 85, quantity: 2 })));
    expect(result).toEqual({ ok: true });
    expect(flow.current.state).toMatchObject({ kind: "edit", name: "Majonez za salatu", lockName: false, lockPrice: true, inProducts: true });
  });

  it("leaves an item that isn't in the database editable, and doesn't look up one without a barcode", async () => {
    lookupArticle.mockResolvedValue(null);
    const flow = flowFor();
    await act(() => flow.current.edit({ id: "r5", barcode: "12345", name: "Mleko", price: null, quantity: null }));
    expect(flow.current.state).toMatchObject({ lockName: false, lockPrice: false, inProducts: false });
    lookupArticle.mockClear();
    await act(() => flow.current.edit({ id: "r6", barcode: null, name: "Hleb", price: null, quantity: null }));
    expect(lookupArticle).not.toHaveBeenCalled();
    expect(flow.current.state).toMatchObject({ kind: "edit", lockName: false });
  });

  describe("saving a changed name in the database", () => {
    const majonez = { barcode: "8600005000122", name: "MAJONEZ 175", price: 85 };
    const scanned = async () => {
      requisitionStore.findItem.mockResolvedValue(null);
      lookupArticle.mockResolvedValue(majonez);
      requisitionStore.addItem.mockResolvedValue({ item: { id: "r7", name: "Majonez za salatu", quantity: null } });
      const flow = flowFor();
      await act(() => flow.current.start("8600005000122"));
      return flow;
    };

    it("remembers which database row the article is, unticked", async () => {
      const flow = await scanned();
      expect(flow.current.state).toMatchObject({ productBarcode: "8600005000122", productName: "MAJONEZ 175", saveName: false });
    });

    it("writes the new name to the article's database row when ticked", async () => {
      renameProduct.mockResolvedValue();
      const flow = await scanned();
      act(() => flow.current.setField("name", "Majonez za salatu"));
      act(() => flow.current.setField("saveName", true));
      expect(await save(flow)).toMatchObject({ ok: true, action: "added", nameInProducts: "saved" });
      expect(renameProduct).toHaveBeenCalledWith("8600005000122", "Majonez za salatu");
    });

    it("leaves the database alone when not ticked, or when the name is the database's", async () => {
      const flow = await scanned();
      act(() => flow.current.setField("name", "Majonez za salatu"));
      expect(await save(flow)).toMatchObject({ ok: true, nameInProducts: undefined });
      const again = await scanned();
      act(() => again.current.setField("saveName", true));
      await save(again);
      expect(renameProduct).not.toHaveBeenCalled();
    });

    it("keeps the item saved when the name can't be written to the database", async () => {
      renameProduct.mockRejectedValue(new Error("Failed to fetch"));
      const flow = await scanned();
      act(() => flow.current.setField("name", "Majonez za salatu"));
      act(() => flow.current.setField("saveName", true));
      expect(await save(flow)).toMatchObject({ ok: true, action: "added", nameInProducts: "failed" });
    });

    it("can save the name from an edit too, onto the row the lookup found", async () => {
      lookupArticle.mockResolvedValue({ ...majonez, barcode: "860000500012" });
      requisitionStore.updateItem.mockResolvedValue({ id: "r4", name: "Majonez za salatu", quantity: 2 });
      renameProduct.mockResolvedValue();
      const flow = flowFor();
      await act(() => flow.current.edit({ id: "r4", barcode: "8600005000122", name: "MAJONEZ 175", price: 85, quantity: 2 }));
      act(() => flow.current.setField("name", "Majonez za salatu"));
      act(() => flow.current.setField("saveName", true));
      expect(await save(flow)).toMatchObject({ ok: true, action: "updated", nameInProducts: "saved" });
      expect(renameProduct).toHaveBeenCalledWith("860000500012", "Majonez za salatu");
    });
  });

  it("reports a failed lookup on edit instead of opening it unlocked", async () => {
    lookupArticle.mockRejectedValue(new Error("Failed to fetch"));
    const flow = flowFor();
    let result;
    await act(async () => (result = await flow.current.edit({ id: "r4", barcode: "8600005000122", name: "MAJONEZ 175", price: 85, quantity: 2 })));
    expect(result).toEqual({ ok: false, reason: "network" });
    expect(flow.current.state.kind).toBe("idle");
  });
});
