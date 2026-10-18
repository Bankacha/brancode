import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, FileDown, Keyboard, Pencil, ScanBarcode, WifiOff } from "lucide-react";
import { inventoryStore } from "../lib/inventories.js";
import { formatPrice } from "../lib/format.js";
import { formatQuantity, inventoryTitle } from "../lib/listFormat.js";
import { leaveScreen } from "../lib/navigation.js";
import { useInventoryItemFlow } from "../lib/useInventoryItemFlow.js";
import { useLoad } from "../lib/useLoad.js";
import { useSheet } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import IconButton from "../components/IconButton.jsx";
import ListItemRow from "../components/ListItemRow.jsx";
import { itemCount } from "../sheets/ConfirmDeleteListSheet.jsx";
import InventoryFormSheet from "../sheets/InventoryFormSheet.jsx";
import InventoryItemSheet from "../sheets/InventoryItemSheet.jsx";
import { LoadError } from "./InventoryLists.jsx";
import { savedToast } from "./inventoryToasts.js";

const UNDO_MS = 4000;

// /popis/:id — one popis: its items, editing them, and the way to scan,
// type or export. Reloaded on open and after every change (other phones may
// be counting the same popis).
export default function Inventory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const sheet = useSheet();
  const toast = useToast();
  const flow = useInventoryItemFlow(id);
  const data = useLoad(async () => {
    const [inventory, items] = await Promise.all([inventoryStore.get(id), inventoryStore.items(id)]);
    return { inventory, items };
  }, [id]);
  const [hidden, setHidden] = useState(() => new Set()); // removed here, waiting for the database
  const [saving, setSaving] = useState(false);

  const inventory = data.data?.inventory;
  const items = (data.data?.items ?? []).filter((item) => !hidden.has(item.id));

  // Deleted on another phone (or a stale link).
  useEffect(() => {
    if (data.data && data.data.inventory === null) {
      toast.show({ kind: "info", text: "Popis više ne postoji." });
      navigate("/popis", { replace: true });
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
      await inventoryStore.removeItem(item.id);
      toast.show({
        kind: "success",
        text: `Uklonjeno: ${item.name}`,
        duration: UNDO_MS,
        action: { label: "Vrati", run: () => restore(item) },
      });
    } catch (e) {
      offline("Nema veze. Stavka nije uklonjena.");
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
      await inventoryStore.restoreItem(id, item);
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
      await inventoryStore.update(id, fields);
      sheet.close();
      data.reload();
    } catch (e) {
      offline("Nema veze. Popis nije izmenjen.");
    } finally {
      setSaving(false);
    }
  };

  if (data.error && !data.data) {
    return (
      <div className="px-5 pt-[calc(16px+env(safe-area-inset-top))]">
        <IconButton label="Nazad" icon={ArrowLeft} onClick={() => leaveScreen(navigate, location, "/popis")} />
        <LoadError text="Nema veze. Popis nije učitan." onRetry={data.reload} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(160px+env(safe-area-inset-bottom))]">
      <header className="flex items-start gap-3">
        <IconButton label="Nazad" icon={ArrowLeft} onClick={() => leaveScreen(navigate, location, "/popis")} />
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] text-ink">{inventory ? inventoryTitle(inventory) : "Popis"}</h1>
          <p className="text-[13px] text-ink-3">{inventory ? itemCount(items.length) : "Učitavanje…"}</p>
        </div>
        {inventory && <IconButton label="Izmeni naziv i period" icon={Pencil} onClick={() => sheet.open("edit-list")} />}
      </header>

      {inventory && items.length === 0 && <p className="mt-10 text-center text-[15px] text-ink-3">Prazno. Skeniraj prvi artikal.</p>}
      <ul className="mt-5 flex flex-col gap-2">
        {items.map((item) => (
          <ListItemRow
            key={item.id}
            name={item.name}
            detail={`${item.barcode} · ${formatPrice(item.price)}`}
            quantity={formatQuantity(item.quantity)}
            onLongPress={() => edit(item)}
            onRemove={() => remove(item)}
          />
        ))}
      </ul>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto flex h-[calc(140px+env(safe-area-inset-bottom))] w-full max-w-[480px] items-center justify-center gap-7 bg-linear-to-b from-bg/0 to-bg to-40% pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            aria-label="Ručni unos"
            onClick={() => navigate(`/popis/${id}/rucni-unos`)}
            className="pointer-events-auto flex size-[52px] items-center justify-center rounded-full border-[1.5px] border-border-soft bg-surface text-ink transition-transform duration-100 active:scale-[.97]"
          >
            <Keyboard size={22} />
          </button>
          <button
            type="button"
            aria-label="Skeniraj"
            onClick={() => navigate(`/popis/${id}/skeniranje`)}
            className="pointer-events-auto flex size-[84px] items-center justify-center rounded-full bg-accent text-white shadow-scan transition-transform duration-100 active:scale-[.97]"
          >
            <ScanBarcode size={36} />
          </button>
          <button
            type="button"
            aria-label="Izvoz"
            disabled={items.length === 0}
            onClick={() => sheet.open("export")}
            className="pointer-events-auto flex size-[52px] items-center justify-center rounded-full bg-ink text-bg transition-transform duration-100 active:scale-[.97] disabled:opacity-50"
          >
            <FileDown size={22} />
          </button>
        </div>
      </nav>

      <InventoryItemSheet flow={flow} open={sheet.name === "item" && flow.state.kind !== "idle"} onClose={closeItem} source="list" onSubmit={saveItem} />
      <InventoryFormSheet
        open={sheet.name === "edit-list" && Boolean(inventory)}
        onClose={sheet.close}
        initial={inventory}
        heading="Izmeni popis"
        submitLabel="Sačuvaj"
        saving={saving}
        onSubmit={rename}
      />
    </div>
  );
}
