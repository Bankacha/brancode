import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, Pencil, WifiOff } from "lucide-react";
import { downloadBlob } from "../lib/download.js";
import { sendFileByEmail } from "../lib/email.js";
import { buildPdfBlob } from "../lib/listPdf.js";
import { formatQuantity, itemCount } from "../lib/listFormat.js";
import { leaveScreen } from "../lib/navigation.js";
import { useListItemFlow } from "../lib/useListItemFlow.js";
import { useLoad } from "../lib/useLoad.js";
import { useSheet } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import IconButton from "../components/IconButton.jsx";
import ListItemRow from "../components/ListItemRow.jsx";
import LoadError from "../components/LoadError.jsx";
import ListBottomBar from "../components/ListBottomBar.jsx";
import ListItemSheet from "../sheets/ListItemSheet.jsx";
import ExportSheet from "../sheets/ExportSheet.jsx";
import { savedToast } from "./listToasts.js";

const UNDO_MS = 4000;

// /popis/:id and /trebovanje/:id — one list: its items, editing them, and
// the way to scan, type or export. `screen` (listScreens.js) says what kind
// of list it is. Reloaded on open and after every change (other phones may
// be working on the same list).
export default function ListDetail({ screen }) {
  const { kind, texts } = screen;
  const { store, section } = kind;
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const sheet = useSheet();
  const toast = useToast();
  const flow = useListItemFlow(id, kind);
  const data = useLoad(async () => {
    const [list, items] = await Promise.all([store.get(id), store.items(id)]);
    return { list, items };
  }, [id]);
  const [hidden, setHidden] = useState(() => new Set()); // removed here, waiting for the database
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const list = data.data?.list;
  const items = (data.data?.items ?? []).filter((item) => !hidden.has(item.id));

  // Deleted on another phone (or a stale link).
  useEffect(() => {
    if (data.data && data.data.list === null) {
      toast.show({ kind: "info", text: texts.gone });
      navigate(`/${section}`, { replace: true });
    }
  }, [data.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // A refreshed page has no flow in progress: drop a stale "item" entry.
  useEffect(() => {
    if (sheet.name === "item" && flow.state.kind === "idle") navigate(".", { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const offline = (text, retry) => toast.show({ kind: "error", icon: WifiOff, text, action: retry && { label: "Ponovi", run: retry } });

  const remove = async (item) => {
    setHidden((h) => new Set(h).add(item.id));
    try {
      await store.removeItem(item.id);
      toast.show({
        kind: "success",
        text: `Uklonjeno: ${item.name}`,
        duration: UNDO_MS,
        action: { label: "Vrati", run: () => restore(item) },
      });
    } catch (e) {
      offline("Nema veze. Stavka nije uklonjena.", () => remove(item));
    }
    await data.reload();
    setHidden((h) => {
      const next = new Set(h);
      next.delete(item.id);
      return next;
    });
  };

  const restore = async (item) => {
    try {
      await store.restoreItem(id, item);
    } catch (e) {
      offline("Nema veze. Stavka nije vraćena.", () => restore(item));
    }
    data.reload();
  };

  const edit = (item) => {
    flow.edit(item);
    sheet.open("item");
  };

  const closeItem = () => {
    sheet.close();
    flow.cancel();
  };

  const saveItem = async () => {
    const result = await flow.save();
    if (result.ok) {
      toast.show(savedToast(result));
      sheet.close();
    } else if (result.reason === "network") offline("Nema veze. Nije sačuvano.");
    else if (result.reason === "gone") {
      toast.show({ kind: "info", text: "Stavka je u međuvremenu obrisana." });
      sheet.close();
    }
    data.reload();
  };

  const rename = async (fields) => {
    setSaving(true);
    try {
      await store.update(id, fields);
      sheet.close();
      data.reload();
    } catch (e) {
      offline(texts.notRenamed);
    } finally {
      setSaving(false);
    }
  };

  // Made from the latest items (other phones may have added some); offline
  // the download still works from what is on screen.
  const exportPdf = async (how) => {
    setExporting(true);
    toast.show({ kind: "loading", text: "Pravim PDF…" });
    try {
      const latest = (await data.reload()) ?? data.data;
      const blob = await buildPdfBlob(screen.pdf.definition(latest.list, latest.items));
      const filename = screen.pdf.filename(latest.list);
      if (how === "download") {
        downloadBlob(blob, filename);
        toast.show({ kind: "success", icon: Check, text: "PDF je preuzet." });
      } else {
        await sendFileByEmail(filename, blob, { subject: screen.pdf.subject(latest.list) });
        toast.show({ kind: "success", icon: Check, text: "PDF je poslat mejlom." });
      }
      sheet.close();
    } catch (e) {
      if (e.message === "file-too-large")
        toast.show({ kind: "error", text: "PDF je prevelik za mejl. Preuzmi ga i pošalji ručno.", action: { label: "Preuzmi", run: () => exportPdf("download") } });
      else offline("Nema veze. PDF nije poslat.", () => exportPdf(how));
    } finally {
      setExporting(false);
    }
  };

  if (data.error && !data.data) {
    return (
      <div className="px-5 pt-[calc(16px+env(safe-area-inset-top))]">
        <IconButton label="Nazad" icon={ArrowLeft} onClick={() => leaveScreen(navigate, location, `/${section}`)} />
        <LoadError text={texts.notLoaded} onRetry={data.reload} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(160px+env(safe-area-inset-bottom))]">
      <header className="flex items-start gap-3">
        <IconButton label="Nazad" icon={ArrowLeft} onClick={() => leaveScreen(navigate, location, `/${section}`)} />
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] text-ink">{list ? screen.title(list) : texts.fallbackTitle}</h1>
          <p className="text-[13px] text-ink-3">{list ? itemCount(items.length) : "Učitavanje…"}</p>
        </div>
        {list && <IconButton label={texts.rename} icon={Pencil} onClick={() => sheet.open("edit-list")} />}
      </header>

      {list && items.length === 0 && <p className="mt-10 text-center text-[15px] text-ink-3">Prazno. Skeniraj prvi artikal.</p>}
      <ul className="mt-5 flex flex-col gap-2">
        {items.map((item) => (
          <ListItemRow
            key={item.id}
            name={item.name}
            detail={screen.detail(item)}
            quantity={item.quantity === null ? null : formatQuantity(item.quantity)}
            onLongPress={() => edit(item)}
            onRemove={() => remove(item)}
          />
        ))}
      </ul>

      <ListBottomBar
        onType={() => navigate(`/${section}/${id}/rucni-unos`)}
        onScan={() => navigate(`/${section}/${id}/skeniranje`)}
        onExport={() => sheet.open("export")}
        canExport={Boolean(screen.pdf) && items.length > 0}
      />

      <ListItemSheet flow={flow} texts={kind.texts} open={sheet.name === "item" && flow.state.kind !== "idle"} onClose={closeItem} source="list" onSubmit={saveItem} />
      <ExportSheet
        open={sheet.name === "export"}
        onClose={sheet.close}
        count={items.length}
        busy={exporting}
        onDownload={() => exportPdf("download")}
        onEmail={() => exportPdf("email")}
      />
      <screen.FormSheet
        open={sheet.name === "edit-list" && Boolean(list)}
        onClose={sheet.close}
        initial={list}
        heading={texts.renameHeading}
        submitLabel="Sačuvaj"
        saving={saving}
        onSubmit={rename}
      />
    </div>
  );
}
