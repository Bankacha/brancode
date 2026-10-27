// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { renderHook, act } from "@testing-library/react";
import { useProductEditor } from "./useProductEditor.js";
import { lookupProduct, saveProduct } from "./products.js";

vi.mock("./products.js", () => ({ lookupProduct: vi.fn(), saveProduct: vi.fn() }));

const a = { id: "a", barcode: "1", name: "A", price: 1 };
const b = { id: "b", barcode: "2", name: "Lista", price: 12.5, notInDb: true };
const c = { id: "c", barcode: "3", name: "C", price: 3 };

const setup = (initial = [a, b, c]) =>
  renderHook(() => {
    const [queue, setQueue] = useState(initial);
    return { queue, editor: useProductEditor(queue, setQueue) };
  });

describe("useProductEditor", () => {
  beforeEach(() => {
    vi.mocked(lookupProduct).mockReset().mockResolvedValue(null);
    vi.mocked(saveProduct).mockReset().mockResolvedValue(undefined);
  });

  it("opens a list item with the list's name and price", async () => {
    const { result } = setup();
    await act(() => result.current.editor.openItem(b));
    expect(result.current.editor.name).toBe("Lista");
    expect(result.current.editor.price).toBe("12,5");
    expect(result.current.editor.badge).toBe("Nije u bazi");
  });

  it("saves a 'nije u bazi' item to the database and keeps it in place as ready", async () => {
    const { result } = setup();
    await act(() => result.current.editor.openItem(b));
    await act(() => result.current.editor.save());
    expect(saveProduct).toHaveBeenCalledWith({ barcode: "2", name: "Lista", price: 12.5 }, null);
    expect(result.current.queue).toEqual([a, { id: "b", barcode: "2", name: "Lista", price: 12.5 }, c]);
  });

  it("saves a scan found via the 12-digit fallback onto that row", async () => {
    vi.mocked(lookupProduct).mockResolvedValue({ barcode: "860000500012", name: "MAJONEZ 175", price: 84 });
    const { result } = setup([]);
    await act(() => result.current.editor.open("8600005000122"));
    expect(result.current.editor.badge).toBe("U bazi");
    await act(() => result.current.editor.save());
    expect(saveProduct).toHaveBeenCalledWith({ barcode: "8600005000122", name: "MAJONEZ 175", price: 84 }, "860000500012");
  });

  it("keeps the editor open with the typed values when saving fails", async () => {
    vi.mocked(saveProduct).mockRejectedValue(new Error("offline"));
    const { result } = setup();
    await act(() => result.current.editor.openItem(b));
    act(() => result.current.editor.setPrice("15"));
    let saved;
    await act(async () => {
      saved = await result.current.editor.save();
    });
    expect(saved).toBeNull();
    expect(result.current.editor.error).toBe("save");
    expect(result.current.editor.barcode).toBe("2");
    expect(result.current.editor.price).toBe("15");
    expect(result.current.queue).toEqual([a, b, c]);
  });

  it("only allows saving a name with a price above zero", async () => {
    const { result } = setup();
    await act(() => result.current.editor.openItem(b));
    act(() => result.current.editor.setPrice("0"));
    expect(result.current.editor.canSave).toBe(false);
    act(() => result.current.editor.setPrice("79"));
    expect(result.current.editor.canSave).toBe(true);
  });

  it("remembers the database price to show what it was", async () => {
    vi.mocked(lookupProduct).mockResolvedValue({ barcode: "8606107654321", name: "Hleb beli 500g", price: 79 });
    const { result } = setup([]);
    await act(() => result.current.editor.open("8606107654321"));
    expect(result.current.editor.oldPrice).toBe("79,00");
  });

  it("adds the article to the list without saving it when skipped", async () => {
    vi.mocked(lookupProduct).mockResolvedValue({ barcode: "8606107654321", name: "Hleb beli 500g", price: 79 });
    const { result } = setup([a]);
    await act(() => result.current.editor.open("8606107654321"));
    act(() => {
      result.current.editor.skip();
    });
    expect(saveProduct).not.toHaveBeenCalled();
    expect(result.current.queue.map((q) => [q.barcode, q.name, q.price])).toEqual([
      ["1", "A", 1],
      ["8606107654321", "Hleb beli 500g", 79],
    ]);
    expect(result.current.editor.barcode).toBeNull();
  });

  it("keeps the copies of an article that is scanned again", async () => {
    vi.mocked(lookupProduct).mockResolvedValue({ barcode: "1", name: "A", price: 1 });
    const { result } = setup([{ ...a, copies: 3 }, c]);
    await act(() => result.current.editor.open("1"));
    expect(result.current.editor.copies).toBe(3);
    await act(() => result.current.editor.save());
    expect(result.current.queue).toEqual([{ id: "a", barcode: "1", name: "A", price: 1, copies: 3 }, c]);
  });

  it("keeps the copies when a scanned article is skipped", async () => {
    vi.mocked(lookupProduct).mockResolvedValue({ barcode: "1", name: "A", price: 1 });
    const { result } = setup([{ ...a, copies: 3 }]);
    await act(() => result.current.editor.open("1"));
    act(() => {
      result.current.editor.skip();
    });
    expect(result.current.queue[0].copies).toBe(3);
  });

  it("starts at one copy for an article that isn't on the list", async () => {
    const { result } = setup([{ ...a, copies: 3 }]);
    await act(() => result.current.editor.open("9"));
    expect(result.current.editor.copies).toBe(1);
  });

  it("saves the copies chosen in the editor", async () => {
    const { result } = setup();
    await act(() => result.current.editor.openItem(b));
    act(() => result.current.editor.setCopies(4));
    await act(() => result.current.editor.save());
    expect(result.current.queue[1].copies).toBe(4);
    await act(() => result.current.editor.openItem(result.current.queue[1]));
    expect(result.current.editor.copies).toBe(4);
    act(() => result.current.editor.setCopies(1));
    await act(() => result.current.editor.save());
    expect("copies" in result.current.queue[1]).toBe(false);
  });

  it("keeps the leaflet promotion of an article that is scanned again", async () => {
    const promo = { dateFrom: "2026-09-25", dateTo: "2026-10-31" };
    vi.mocked(lookupProduct).mockResolvedValue({ barcode: "1", name: "A", price: 1 });
    const { result } = setup([{ ...a, promo }, c]);
    await act(() => result.current.editor.open("1"));
    expect(result.current.editor.promo).toEqual(promo);
    await act(() => result.current.editor.save());
    expect(result.current.queue[0].promo).toEqual(promo);
    await act(() => result.current.editor.openItem(c));
    expect(result.current.editor.promo).toBeNull();
    await act(() => result.current.editor.save());
    expect("promo" in result.current.queue[1]).toBe(false);
  });

  it("keeps the Mix choice of an article that is scanned again", async () => {
    vi.mocked(lookupProduct).mockResolvedValue({ barcode: "1", name: "A", price: 1 });
    const { result } = setup([{ ...a, mixFormat: "fridge" }]);
    await act(() => result.current.editor.open("1"));
    expect(result.current.editor.mixFormat).toBe("fridge");
    await act(() => result.current.editor.save());
    expect(result.current.queue[0].mixFormat).toBe("fridge");
  });

  it("saves only barcode, name and price to the database, never the Mix choice", async () => {
    const { result } = setup([{ ...a, mixFormat: "fridge" }]);
    await act(() => result.current.editor.openItem({ ...a, mixFormat: "fridge" }));
    await act(() => result.current.editor.save());
    expect(saveProduct).toHaveBeenCalledWith({ barcode: "1", name: "A", price: 1 }, null);
  });

  it("takes the full code for 12 typed digits of an article stored with 13", async () => {
    vi.mocked(lookupProduct).mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: 84 });
    const { result } = setup([]);
    await act(() => result.current.editor.open("860000500012"));
    expect(result.current.editor.barcode).toBe("8600005000122");
    expect(result.current.editor.badge).toBe("U bazi");
    await act(() => result.current.editor.save());
    expect(saveProduct).toHaveBeenCalledWith({ barcode: "8600005000122", name: "MAJONEZ 175", price: 84 }, "8600005000122");
    expect(result.current.queue[0].barcode).toBe("8600005000122");
  });

  it("edits a short list row of an article stored with its full code onto that row, in place", async () => {
    vi.mocked(lookupProduct).mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: 84 });
    const short = { id: "s", barcode: "860000500012", name: "MAJONEZ 175", price: 84 };
    const { result } = setup([short, c]);
    await act(() => result.current.editor.openItem(short));
    expect(result.current.editor.barcode).toBe("8600005000122");
    await act(() => result.current.editor.save());
    expect(saveProduct).toHaveBeenCalledWith({ barcode: "8600005000122", name: "MAJONEZ 175", price: 84 }, "8600005000122");
    expect(result.current.queue.map((q) => [q.id, q.barcode])).toEqual([
      ["s", "8600005000122"],
      ["c", "3"],
    ]);
  });

  it("keeps copies, promotion and Mix choice when the article is typed short but listed under its full code", async () => {
    const promo = { dateFrom: "2026-09-25", dateTo: "2026-10-31" };
    const listed = { id: "l", barcode: "8600005000122", name: "MAJONEZ 175", price: 84, copies: 3, promo, mixFormat: "fridge" };
    vi.mocked(lookupProduct).mockResolvedValue({ barcode: "8600005000122", name: "MAJONEZ 175", price: 84 });
    const { result } = setup([listed]);
    await act(() => result.current.editor.open("860000500012"));
    expect(result.current.editor.copies).toBe(3);
    await act(() => result.current.editor.save());
    expect(result.current.queue).toEqual([{ ...listed }]);
  });
});
