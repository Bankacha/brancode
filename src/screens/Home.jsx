import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Check, CircleAlert, Ellipsis, Eye, FileUp, Keyboard, Printer, ScanBarcode, WifiOff } from "lucide-react";
import { supabase } from "../supabaseClient";
import { parseLeafletPdf, matchLeafletRows, saveLeafletPrices } from "../promoLeaflet.js";
import { plural } from "../lib/plural.js";
import { formatPrice } from "../lib/format.js";
import { withoutItem, withItemRestored } from "../lib/printQueue.js";
import { useSheet } from "../lib/useSheet.js";
import { usePrintFormat } from "../lib/printFormat.js";
import { useToast } from "../components/Toast.jsx";
import QueueRow from "../components/QueueRow.jsx";
import MenuSheet from "../sheets/MenuSheet.jsx";
import ConfirmClearSheet from "../sheets/ConfirmClearSheet.jsx";
import EditSheet from "../sheets/EditSheet.jsx";
import LeafletImportSheet from "../sheets/LeafletImportSheet.jsx";

const UNDO_MS = 4000;

function IconButton({ label, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full bg-surface-muted text-ink transition-transform duration-100 active:scale-[.97]"
    >
      <Icon size={20} />
    </button>
  );
}

function GroupTitle({ dot, className = "", children, action }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className={`flex items-center gap-2 text-[13px] font-bold ${className}`}>
        <span className={`size-2 rounded-full ${dot}`} />
        {children}
      </h2>
      {action}
    </div>
  );
}

// Handoff "02 · Početna + lista".
export default function Home({ queue, setQueue, editor, session }) {
  const navigate = useNavigate();
  const sheet = useSheet();
  const toast = useToast();
  const [format] = usePrintFormat();
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const leafletInputRef = useRef(null);
  const [leaflet, setLeaflet] = useState(null); // { fileName, matches } once a PDF has been read
  const [leafletSaving, setLeafletSaving] = useState(false);

  const check = queue.filter((q) => q.notInDb);
  const ready = queue.filter((q) => !q.notInDb);
  const n = queue.length;
  const m = check.length;

  const summary =
    n === 0
      ? "Skeniraj prvi artikal"
      : m > 0
        ? `${m} ${plural(m, "traži", "traže", "traže")} proveru pre štampe`
        : "Sve je spremno za štampu";

  const remove = (item) => {
    const { next, removed } = withoutItem(queue, item.id);
    if (!removed) return;
    setQueue(next);
    toast.show({
      kind: "success",
      text: `Uklonjeno: ${item.name}`,
      duration: UNDO_MS,
      action: { label: "Vrati", run: () => setQueue(withItemRestored(queueRef.current, removed)) },
    });
  };

  const edit = (item) => {
    editor.openItem(item);
    sheet.open("edit");
  };

  // After a refresh the history can still say "edit" while the editor's data
  // is gone; drop that entry instead of showing an empty sheet.
  useEffect(() => {
    const stale = (sheet.name === "edit" && editor.barcode === null) || (sheet.name === "leaflet" && leaflet === null);
    if (stale) navigate(".", { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The file picker must open synchronously inside the click (browsers block
  // file dialogs opened after an await). The PDF is only read in memory.
  const onLeafletChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    toast.show({ kind: "loading", text: "Čitam liflet…" });
    try {
      const rows = await parseLeafletPdf(await file.arrayBuffer(), (page, total) =>
        toast.show({ kind: "loading", text: "Čitam liflet…", detail: `strana ${page} / ${total}` })
      );
      const matches = await matchLeafletRows(rows);
      toast.hide();
      setLeaflet({ fileName: file.name, matches });
      sheet.open("leaflet");
    } catch (err) {
      console.error("leaflet read failed", err);
      toast.show({
        kind: "error",
        icon: CircleAlert,
        text: err.userFacing ? err.message : "Čitanje lifleta nije uspelo. Proveri internet konekciju i probaj ponovo.",
      });
    }
  };

  const confirmLeaflet = async () => {
    setLeafletSaving(true);
    try {
      await saveLeafletPrices(leaflet.matches);
      const stamp = Date.now();
      // Every leaflet article goes on the list (the user prunes it with X);
      // ones we don't carry are flagged so they're easy to spot.
      const imported = leaflet.matches.map(({ ean, name, price, existing }, i) => ({
        id: `${ean}-${stamp}-${i}`,
        barcode: ean,
        name: existing ? existing.name : name,
        price,
        notInDb: !existing,
      }));
      setQueue(imported);
      sheet.close();
      setLeaflet(null);
      toast.show({ kind: "success", text: `Uvezeno u listu: ${imported.length}` });
    } catch (err) {
      console.error("leaflet save failed", err);
      toast.show({ kind: "error", icon: CircleAlert, text: "Čuvanje akcijskih cena nije uspelo. Proveri internet konekciju i probaj ponovo." });
    }
    setLeafletSaving(false);
  };

  const saveEdit = async () => {
    const saved = await editor.save();
    if (saved) {
      sheet.close();
      toast.show({ kind: "success", icon: Check, text: `Dodato: ${saved.name}`, detail: formatPrice(saved.price) });
    } else {
      toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Nije sačuvano.", action: { label: "Ponovi", run: () => saveRef.current() } });
    }
  };
  const saveRef = useRef(saveEdit);
  saveRef.current = saveEdit;

  const closeEdit = () => {
    sheet.close();
    editor.close();
  };

  const signOut = () => {
    sheet.close();
    supabase.auth.signOut();
  };

  const clearList = () => {
    setQueue([]);
    sheet.close();
  };

  const rows = (items, tone) => (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <QueueRow key={item.id} item={item} tone={tone} onLongPress={() => edit(item)} onRemove={() => remove(item)} />
      ))}
    </ul>
  );

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(160px+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <span className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink">brancode</span>
        <div className="flex gap-2">
          <IconButton label="Uvezi akcijski liflet" icon={FileUp} onClick={() => leafletInputRef.current.click()} />
          <IconButton label="Meni" icon={Ellipsis} onClick={() => sheet.open("menu")} />
        </div>
      </header>
      <input ref={leafletInputRef} type="file" accept="application/pdf" onChange={onLeafletChosen} className="hidden" />

      <section className="mt-[18px] flex items-center gap-3 rounded-card bg-ink py-[18px] pr-[18px] pl-5 text-bg">
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-[40px] leading-none font-extrabold">{n}</span>
            <span className="text-[18px] font-medium">{plural(n, "cenovnik", "cenovnika", "cenovnika")}</span>
          </p>
          <p className="mt-1 text-[13px] text-ink-on-dark-muted">{summary}</p>
        </div>
        <button
          type="button"
          disabled={n === 0}
          onClick={() => navigate("/pregled")}
          className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-bg px-4 text-[15px] font-semibold text-ink transition-transform duration-100 active:scale-[.97] disabled:opacity-50"
        >
          <Eye size={18} /> Pregled
        </button>
      </section>

      {m > 0 && (
        <section className="mt-5">
          <GroupTitle dot="bg-accent" className="text-accent">
            Za proveru · nije u bazi
          </GroupTitle>
          {rows(check, "check")}
        </section>
      )}

      {ready.length > 0 && (
        <section className="mt-5">
          <GroupTitle
            dot="bg-success"
            className="text-ink"
            action={
              <button type="button" onClick={() => sheet.open("confirm-clear")} className="text-[13px] font-medium text-ink-3">
                Obriši sve
              </button>
            }
          >
            Spremno · {ready.length}
          </GroupTitle>
          {rows(ready, "ready")}
        </section>
      )}

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto flex h-[calc(140px+env(safe-area-inset-bottom))] w-full max-w-[480px] items-center justify-center gap-7 bg-linear-to-b from-bg/0 to-bg to-40% pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            aria-label="Ručni unos"
            onClick={() => navigate("/rucni-unos")}
            className="pointer-events-auto flex size-[52px] items-center justify-center rounded-full border-[1.5px] border-border-soft bg-surface text-ink transition-transform duration-100 active:scale-[.97]"
          >
            <Keyboard size={22} />
          </button>
          <button
            type="button"
            aria-label="Skeniraj"
            onClick={() => navigate("/skeniranje")}
            className="pointer-events-auto flex size-[84px] items-center justify-center rounded-full bg-accent text-white shadow-scan transition-transform duration-100 active:scale-[.97]"
          >
            <ScanBarcode size={36} />
          </button>
          <button
            type="button"
            aria-label="Štampa"
            disabled={n === 0}
            onClick={() => navigate("/pregled")}
            className="pointer-events-auto flex size-[52px] items-center justify-center rounded-full bg-ink text-bg transition-transform duration-100 active:scale-[.97] disabled:opacity-50"
          >
            <Printer size={22} />
          </button>
        </div>
      </nav>

      <MenuSheet
        open={sheet.name === "menu"}
        onClose={sheet.close}
        email={session.user.email}
        canClear={n > 0}
        onClear={() => sheet.open("confirm-clear")}
        onSignOut={signOut}
      />
      <ConfirmClearSheet open={sheet.name === "confirm-clear"} onClose={sheet.close} count={n} onConfirm={clearList} />
      <EditSheet editor={editor} open={sheet.name === "edit" && editor.barcode !== null} onClose={closeEdit} onSave={saveEdit} format={format} />
      {leaflet && (
        <LeafletImportSheet
          open={sheet.name === "leaflet"}
          onClose={sheet.close}
          fileName={leaflet.fileName}
          matches={leaflet.matches}
          queueLength={n}
          saving={leafletSaving}
          onConfirm={confirmLeaflet}
        />
      )}
    </div>
  );
}
