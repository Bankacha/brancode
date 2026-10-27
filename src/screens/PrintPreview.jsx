import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Apple, ArrowLeft, ArrowRightLeft, Download, LayoutGrid, MailCheck, Refrigerator, Send, WifiOff } from "lucide-react";
import { PRICE_TAG_STYLES, buildWorkbookBuffer, layoutTagPages, sheetFilename } from "../lib/priceTags.js";
import { plural } from "../lib/plural.js";
import { MIX_FORMATS, mixChoice, splitForMix, tagCount, withMixFormat } from "../lib/printQueue.js";
import { downloadWorkbook } from "../lib/download.js";
import { sendSheetByEmail, sendSheetsByEmail } from "../lib/email.js";
import { readTagFormats, saveTagFormats } from "../lib/tagFormats.js";
import { leaveScreen } from "../lib/navigation.js";
import { usePrintFormat } from "../lib/printFormat.js";
import { useToast } from "../components/Toast.jsx";
import Button from "../components/Button.jsx";
import MixList from "../components/MixList.jsx";
import PrintPage from "../components/PrintPage.jsx";
import ScaledToWidth from "../components/ScaledToWidth.jsx";

const FORMATS = [
  { key: "shelf", label: "Raf", icon: LayoutGrid },
  { key: "fridge", label: "Friz", icon: Refrigerator },
  { key: "fruit", label: "Voće", icon: Apple },
  { key: "mix", label: "Mix", icon: ArrowRightLeft },
];

const NOT_REMEMBERED = "Format nije zapamćen za sledeći put.";

// Handoff "06 · Format + pregled štampe". The A4 pages come from the same
// layout as the Excel export (spec decision 4: drop the preview block if
// paper and preview ever disagree). Mix (spec 2026-10-27) shows the list with
// a Raf | Friz switch per tag instead, and exports one sheet per format.
export default function PrintPreview({ queue, setQueue }) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [format, setFormat] = usePrintFormat();
  const [busy, setBusy] = useState(null); // "send" | "download" while an export runs
  const busyRef = useRef(false); // blocks a second tap before the re-render disables the buttons
  // A toast's action ("Ponovi", "Preuzmi") runs after later taps may have
  // changed Mix choices, so it calls the latest render's export, not its own.
  const latest = useRef({});
  const pagesRef = useRef(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    pagesRef.current?.scrollTo?.({ left: 0 });
    setPage(1);
  }, [format]);

  // Mix starts each article in the format the database remembers for it:
  // list barcode → { dbBarcode, format }.
  const mix = format === "mix";
  const [remembered, setRemembered] = useState({ state: "loading", formats: new Map() });
  useEffect(() => {
    if (!mix || queue.length === 0) return;
    let cancelled = false;
    setRemembered({ state: "loading", formats: new Map() });
    readTagFormats(queue.map((item) => item.barcode))
      .then((formats) => !cancelled && setRemembered({ state: "ready", formats }))
      .catch((e) => {
        console.error("read tag formats failed", e);
        if (!cancelled) setRemembered({ state: "failed", formats: new Map() });
      });
    return () => {
      cancelled = true;
    };
  }, [mix]); // eslint-disable-line react-hooks/exhaustive-deps -- read once on opening Mix

  if (queue.length === 0) return <Navigate to="/" replace />;

  const rememberedOf = (item) => remembered.formats.get(item.barcode)?.format ?? null;
  const choose = (item, next) => setQueue(queue.map((q) => (q.id === item.id ? withMixFormat(q, next) : q)));

  // One sheet per format that has tags, shelf first.
  const mixSheets = () => {
    const groups = splitForMix(queue, rememberedOf);
    return MIX_FORMATS.filter((f) => groups[f].length > 0).map((f) => ({ format: f, items: groups[f] }));
  };

  // After a Mix export: the choices of articles in the database, for the next
  // Mix. Only the format column; a failure doesn't undo the export.
  const rememberChoices = async () => {
    if (remembered.state === "failed") return false; // the database rows aren't known
    const rows = new Map();
    for (const item of queue) {
      const known = remembered.formats.get(item.barcode);
      if (known) rows.set(known.dbBarcode, mixChoice(item, known.format).format);
    }
    if (rows.size === 0) return true;
    try {
      await saveTagFormats([...rows].map(([dbBarcode, f]) => ({ dbBarcode, format: f })));
      return true;
    } catch (e) {
      console.error("save tag formats failed", e);
      return false;
    }
  };

  const sendMix = async () => {
    const sheets = mixSheets();
    if (sheets.length === 1) {
      const [{ format: only, items }] = sheets;
      await sendSheetByEmail(sheetFilename(only), await buildWorkbookBuffer(items, only));
    } else {
      const files = await Promise.all(sheets.map(async ({ format: f, items }) => ({ filename: sheetFilename(f), buffer: await buildWorkbookBuffer(items, f) })));
      await sendSheetsByEmail(files, { subject: "Cenovnici – raf i friz" });
    }
    const saved = await rememberChoices();
    toast.show(saved ? { kind: "success", icon: MailCheck, text: "Poslato na mejl radnje" } : { kind: "info", icon: MailCheck, text: `Poslato na mejl radnje. ${NOT_REMEMBERED}` });
  };

  // A phone may block the second automatic download; the message keeps a
  // button to take the fridge sheet again.
  const downloadMix = async () => {
    const sheets = mixSheets();
    for (const { format: f, items } of sheets) await downloadWorkbook(items, f);
    const saved = await rememberChoices();
    if (sheets.length > 1) {
      const fridge = sheets[1];
      toast.show({
        kind: "info",
        text: saved ? "Preuzeto: 2 fajla" : `Preuzeto: 2 fajla. ${NOT_REMEMBERED}`,
        action: { label: "Preuzmi friz", run: () => downloadWorkbook(fridge.items, fridge.format) },
      });
    } else if (!saved) {
      toast.show({ kind: "info", text: NOT_REMEMBERED });
    } else {
      toast.hide();
    }
  };

  // One export at a time: a second tap while one runs does nothing. In Mix,
  // nothing goes out before the remembered formats are in — the buttons wait,
  // and so does a "Ponovi" left in a message.
  const exclusive = (kind, run) => async () => {
    if (busyRef.current) return;
    if (mix && remembered.state === "loading") {
      toast.show({ kind: "info", text: "Sačekaj da se učitaju zapamćeni formati." });
      return;
    }
    busyRef.current = true;
    setBusy(kind);
    try {
      await run();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const download = exclusive("download", async () => {
    try {
      if (!mix) return await downloadWorkbook(queue, format);
      toast.show({ kind: "loading", text: "Pravim Excel…" });
      await downloadMix();
    } catch (e) {
      console.error("excel download failed", e);
      toast.show({ kind: "error", text: "Excel nije napravljen.", action: { label: "Ponovi", run: () => latest.current.download() } });
    }
  });

  const send = exclusive("send", async () => {
    toast.show({ kind: "loading", text: "Šaljem na mejl…" });
    try {
      if (mix) await sendMix();
      else {
        await sendSheetByEmail(sheetFilename(format), await buildWorkbookBuffer(queue, format));
        toast.show({ kind: "success", icon: MailCheck, text: "Poslato na mejl radnje" });
      }
    } catch (e) {
      console.error("send email failed", e);
      if (e.message === "file-too-large") {
        toast.show({ kind: "error", text: "Cene su prevelike za mejl. Preuzmi Excel i pošalji ručno.", action: { label: "Preuzmi", run: () => latest.current.download() } });
      } else {
        toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Nije poslato.", action: { label: "Ponovi", run: () => latest.current.send() } });
      }
    }
  });
  latest.current = { send, download };

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(34px+env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Nazad"
          onClick={() => leaveScreen(navigate, location)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink transition-transform duration-100 active:scale-[.97]"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 font-display text-[24px] font-extrabold text-ink">Pregled štampe</h1>
        <span className="text-[13px] font-medium text-ink-3">{tagCount(queue)} kom</span>
      </header>

      <div className="mt-4 flex rounded-full bg-surface-muted p-[5px]">
        {FORMATS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={format === key}
            onClick={() => {
              // back into Mix: show loading at once, not the list read last time
              if (key === "mix" && !mix) setRemembered({ state: "loading", formats: new Map() });
              setFormat(key);
            }}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[15px] font-semibold transition-transform duration-100 active:scale-[.97] ${
              format === key ? "bg-ink text-bg" : "text-ink-2"
            }`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>

      {!mix ? (
        <PagePreview queue={queue} format={format} page={page} setPage={setPage} pagesRef={pagesRef} />
      ) : remembered.state === "loading" ? (
        <p className="mt-6 mb-4 flex-1 text-center text-[13px] text-ink-3">Učitavam zapamćene formate…</p>
      ) : (
        <MixList queue={queue} rememberedOf={rememberedOf} loadFailed={remembered.state === "failed"} onChoose={choose} />
      )}

      <div className="flex gap-2.5">
        <Button variant="accent" icon={Send} onClick={send} disabled={busy !== null || (mix && remembered.state === "loading")} className="flex-1">
          Pošalji
        </Button>
        <Button variant="outline" icon={Download} onClick={download} disabled={busy !== null || (mix && remembered.state === "loading")} className="flex-1">
          Excel
        </Button>
      </div>
    </div>
  );
}

// Only the page in view and its neighbours are drawn; the rest keep their
// place as blank A4-shaped slots, so long lists (barcodes!) stay quick.
const DRAWN_PAGES_AROUND = 1;

function PagePreview({ queue, format, page, setPage, pagesRef }) {
  const pages = useMemo(() => layoutTagPages(queue, format), [queue, format]);
  const columns = PRICE_TAG_STYLES[format].columns;
  const onScroll = (e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth) + 1);
  return (
    <div className="mt-4 mb-4 flex flex-1 flex-col justify-center rounded-card bg-surface-muted py-4">
      <div ref={pagesRef} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
        {pages.map((rows, i) => (
          <div key={i} className="w-full shrink-0 snap-center px-4">
            {Math.abs(i - (page - 1)) <= DRAWN_PAGES_AROUND ? (
              <ScaledToWidth widthMm={210} heightMm={297}>
                <PrintPage rows={rows} format={format} />
              </ScaledToWidth>
            ) : (
              <div className="aspect-[210/297] w-full bg-white" />
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[13px] text-ink-3">
        {`A4 · ${columns} ${plural(columns, "kolona", "kolone", "kolona")} · strana ${page} od ${pages.length}`}
      </p>
    </div>
  );
}

