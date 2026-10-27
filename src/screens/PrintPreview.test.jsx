// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../components/Toast.jsx";
import PrintPreview from "./PrintPreview.jsx";
import { sendSheetByEmail, sendSheetsByEmail } from "../lib/email.js";
import { buildWorkbookBuffer } from "../lib/priceTags.js";
import { downloadWorkbook } from "../lib/download.js";
import { readTagFormats, saveTagFormats } from "../lib/tagFormats.js";

vi.mock("../lib/email.js", () => ({ sendSheetByEmail: vi.fn(), sendSheetsByEmail: vi.fn() }));
vi.mock("../lib/download.js", () => ({ downloadWorkbook: vi.fn(async () => {}) }));
vi.mock("../lib/tagFormats.js", () => ({ readTagFormats: vi.fn(), saveTagFormats: vi.fn() }));
vi.mock("../lib/priceTags.js", async (importOriginal) => ({
  ...(await importOriginal()),
  buildWorkbookBuffer: vi.fn(async () => new ArrayBuffer(8)),
  sheetFilename: (format) => (format === "fridge" ? "cenovnik-frizider.xlsx" : "cenovnik-raf.xlsx"),
  makeBarcodeDataUrl: () => "data:image/png;base64,AAA", // jsdom has no canvas
}));

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, barcode: `${i}`, name: `A${i}`, price: 10 }));

function Harness({ initial }) {
  const [queue, setQueue] = useState(initial);
  return <PrintPreview queue={queue} setQueue={setQueue} />;
}

const setup = (queue) =>
  render(
    <MemoryRouter initialEntries={["/", "/pregled"]} initialIndex={1}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<p>HOME</p>} />
          <Route path="/pregled" element={<Harness initial={queue} />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

const pressed = (name) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

describe("PrintPreview", () => {
  beforeEach(() => localStorage.clear());

  it("shows the tag count with shelf tags chosen by default", () => {
    setup(items(7));
    expect(screen.getByText("7 kom")).toBeTruthy();
    expect(pressed("Raf")).toBe("true");
  });

  it("counts copies as printed tags", () => {
    const [first, second] = items(2);
    setup([{ ...first, copies: 3 }, second]);
    expect(screen.getByText("4 kom")).toBeTruthy();
  });

  it("switches format and remembers it on this device", () => {
    setup(items(7));
    fireEvent.click(screen.getByRole("button", { name: "Voće" }));
    expect(pressed("Voće")).toBe("true");
    expect(pressed("Raf")).toBe("false");
    expect(localStorage.getItem("print-format")).toBe("fruit");
  });

  it("goes home when there is nothing to print", () => {
    setup([]);
    expect(screen.getByText("HOME")).toBeTruthy();
  });

  it("sends the sheet only once while a send is in flight", async () => {
    vi.mocked(sendSheetByEmail).mockReset().mockReturnValue(new Promise(() => {}));
    setup(items(7));
    const send = screen.getByRole("button", { name: /Pošalji/ });
    fireEvent.click(send);
    fireEvent.click(send);
    await waitFor(() => expect(sendSheetByEmail).toHaveBeenCalledTimes(1));
    expect(send.disabled).toBe(true);
  });

  it("shows which A4 page of how many, with the format's columns", () => {
    setup(items(40));
    expect(screen.getByText("A4 · 3 kolone · strana 1 od 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voće" }));
    expect(screen.getByText("A4 · 2 kolone · strana 1 od 5")).toBeTruthy();
  });

  it("pages through a long list", () => {
    setup(items(120));
    expect(screen.getByText("A4 · 3 kolone · strana 1 od 7")).toBeTruthy();
  });

  it("draws only the pages around the one in view, so a long fruit list stays quick", () => {
    localStorage.setItem("print-format", "fruit");
    setup(items(120)); // 15 pages of 8
    expect(screen.getByText("A4 · 2 kolone · strana 1 od 15")).toBeTruthy();
    expect(screen.getAllByText("10,00")).toHaveLength(16); // page 1 and page 2
  });
});

describe("PrintPreview in Mix", () => {
  // Jogurt isn't in the database, Mleko is remembered as fridge (2 copies),
  // Kinder is in the database without a remembered format.
  const mixQueue = [
    { id: "a", barcode: "111", name: "Jogurt", price: 10 },
    { id: "b", barcode: "222", name: "Mleko", price: 10, copies: 2 },
    { id: "c", barcode: "333", name: "Kinder", price: 10 },
  ];
  const remembered = new Map([
    ["222", { dbBarcode: "222", format: "fridge" }],
    ["333", { dbBarcode: "333", format: null }],
  ]);
  const row = (name) => screen.getByText(name).closest("li");
  const choose = (name, format) => fireEvent.click(within(row(name)).getByRole("radio", { name: format }));
  const openMix = async (queue = mixQueue) => {
    setup(queue);
    fireEvent.click(screen.getByRole("button", { name: "Mix" }));
    await screen.findByText(/^Friz \d+$/);
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(readTagFormats).mockResolvedValue(remembered);
    vi.mocked(saveTagFormats).mockResolvedValue(undefined);
    vi.mocked(sendSheetByEmail).mockResolvedValue(undefined);
    vi.mocked(sendSheetsByEmail).mockResolvedValue(undefined);
  });

  it("offers Raf, Friz, Voće and Mix, and remembers Mix on this device", async () => {
    await openMix();
    for (const name of ["Raf", "Friz", "Voće", "Mix"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(localStorage.getItem("print-format")).toBe("mix");
  });

  it("starts remembered articles in their format and marks the others new", async () => {
    await openMix();
    expect(within(row("Mleko")).getByRole("radio", { name: "Friz" }).getAttribute("aria-checked")).toBe("true");
    expect(within(row("Mleko")).queryByText("NOVO")).toBeNull();
    expect(within(row("Jogurt")).getByText("NOVO")).toBeTruthy();
    expect(within(row("Kinder")).getByRole("radio", { name: "Raf" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Raf 2")).toBeTruthy();
    expect(screen.getByText("Friz 2")).toBeTruthy();
  });

  it("moves a tag over with one tap, counting copies", async () => {
    await openMix();
    choose("Jogurt", "Friz");
    expect(screen.getByText("Raf 1")).toBeTruthy();
    expect(screen.getByText("Friz 3")).toBeTruthy();
    expect(within(row("Jogurt")).queryByText("NOVO")).toBeNull();
  });

  it("sends a single sheet the usual way when everything is on the shelf", async () => {
    vi.mocked(readTagFormats).mockResolvedValue(new Map());
    await openMix();
    fireEvent.click(screen.getByRole("button", { name: /Pošalji/ }));
    await screen.findByText("Poslato na mejl radnje");
    expect(sendSheetByEmail).toHaveBeenCalledTimes(1);
    expect(sendSheetByEmail.mock.calls[0][0]).toBe("cenovnik-raf.xlsx");
    expect(sendSheetsByEmail).not.toHaveBeenCalled();
    expect(vi.mocked(buildWorkbookBuffer).mock.calls.map(([, format]) => format)).toEqual(["shelf"]);
  });

  it("sends one mail with a shelf and a fridge sheet, then remembers the formats of articles in the database", async () => {
    await openMix();
    fireEvent.click(screen.getByRole("button", { name: /Pošalji/ }));
    await screen.findByText("Poslato na mejl radnje");
    const [files, options] = vi.mocked(sendSheetsByEmail).mock.calls[0];
    expect(files.map((f) => f.filename)).toEqual(["cenovnik-raf.xlsx", "cenovnik-frizider.xlsx"]);
    expect(options).toEqual({ subject: "Cenovnici – raf i friz" });
    const groups = vi.mocked(buildWorkbookBuffer).mock.calls.map(([queue, format]) => [format, queue.map((item) => item.name)]);
    expect(groups).toEqual([
      ["shelf", ["Jogurt", "Kinder"]],
      ["fridge", ["Mleko"]],
    ]);
    expect(saveTagFormats).toHaveBeenCalledWith([
      { dbBarcode: "222", format: "fridge" },
      { dbBarcode: "333", format: "shelf" },
    ]);
  });

  it("still reports the mail as sent when the formats can't be remembered", async () => {
    vi.mocked(saveTagFormats).mockRejectedValue(new Error("offline"));
    await openMix();
    fireEvent.click(screen.getByRole("button", { name: /Pošalji/ }));
    expect(await screen.findByText(/Poslato na mejl radnje/)).toBeTruthy();
    expect(screen.getByText(/Format nije zapamćen za sledeći put\./)).toBeTruthy();
  });

  it("downloads both sheets and offers the fridge one again in case the phone blocked it", async () => {
    await openMix();
    fireEvent.click(screen.getByRole("button", { name: /Excel/ }));
    await screen.findByText(/Preuzeto: 2 fajla/);
    expect(vi.mocked(downloadWorkbook).mock.calls.map(([, format]) => format)).toEqual(["shelf", "fridge"]);
    fireEvent.click(screen.getByRole("button", { name: "Preuzmi friz" }));
    expect(vi.mocked(downloadWorkbook).mock.calls.at(-1)[1]).toBe("fridge");
    expect(vi.mocked(downloadWorkbook).mock.calls.at(-1)[0].map((item) => item.name)).toEqual(["Mleko"]);
  });

  it("works without the remembered formats when they can't be loaded, and says they weren't remembered", async () => {
    vi.mocked(readTagFormats).mockRejectedValue(new Error("offline"));
    setup(mixQueue);
    fireEvent.click(screen.getByRole("button", { name: "Mix" }));
    expect(await screen.findByText("Zapamćeni formati nisu učitani.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Pošalji/ }));
    expect(await screen.findByText(/Poslato na mejl radnje\. Format nije zapamćen za sledeći put\./)).toBeTruthy();
    expect(saveTagFormats).not.toHaveBeenCalled();
  });

  it("shows the loading state at once when Mix is chosen again, not the last list", async () => {
    await openMix();
    fireEvent.click(screen.getByRole("button", { name: "Raf" }));
    vi.mocked(readTagFormats).mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Mix" }));
    expect(screen.getByText("Učitavam zapamćene formate…")).toBeTruthy();
    expect(screen.queryByText("Mleko")).toBeNull();
  });

  it("says when the Excel file couldn't be made, and tries again", async () => {
    vi.mocked(downloadWorkbook).mockRejectedValueOnce(new Error("no canvas"));
    await openMix();
    fireEvent.click(screen.getByRole("button", { name: /Excel/ }));
    expect(await screen.findByText("Excel nije napravljen.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ponovi" }));
    await screen.findByText(/Preuzeto: 2 fajla/);
  });

  it("retries a failed send with the choices made since", async () => {
    vi.mocked(sendSheetsByEmail).mockRejectedValueOnce(new Error("send-failed"));
    await openMix();
    fireEvent.click(screen.getByRole("button", { name: /Pošalji/ }));
    await screen.findByText("Nema veze. Nije poslato.");
    choose("Jogurt", "Friz");
    fireEvent.click(screen.getByRole("button", { name: "Ponovi" }));
    await screen.findByText("Poslato na mejl radnje");
    const lastFridge = vi.mocked(buildWorkbookBuffer).mock.calls.filter(([, format]) => format === "fridge").at(-1)[0];
    expect(lastFridge.map((item) => item.name)).toEqual(["Jogurt", "Mleko"]);
  });

  it("offers the Excel files when the two sheets are too big for one mail", async () => {
    vi.mocked(sendSheetsByEmail).mockRejectedValueOnce(new Error("file-too-large"));
    await openMix();
    fireEvent.click(screen.getByRole("button", { name: /Pošalji/ }));
    expect(await screen.findByText(/prevelik/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preuzmi" }));
    await waitFor(() => expect(vi.mocked(downloadWorkbook).mock.calls.map(([, format]) => format)).toEqual(["shelf", "fridge"]));
  });

  it("downloads each sheet once even when Excel is tapped twice", async () => {
    let finish;
    vi.mocked(downloadWorkbook).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    await openMix();
    const excel = screen.getByRole("button", { name: /Excel/ });
    fireEvent.click(excel);
    fireEvent.click(excel);
    expect(excel.disabled).toBe(true);
    finish();
    await screen.findByText(/Preuzeto: 2 fajla/);
    expect(vi.mocked(downloadWorkbook).mock.calls.map(([, format]) => format)).toEqual(["shelf", "fridge"]);
  });
});
