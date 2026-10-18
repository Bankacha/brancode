import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, WifiOff } from "lucide-react";
import { inventoryStore } from "../lib/inventories.js";
import { inventoryTitle, itemCount } from "../lib/listFormat.js";
import { useLoad } from "../lib/useLoad.js";
import { useSheet } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import AppHeader from "../components/AppHeader.jsx";
import Button from "../components/Button.jsx";
import LoadError from "../components/LoadError.jsx";
import ListCard from "../components/ListCard.jsx";
import ConfirmDeleteListSheet from "../sheets/ConfirmDeleteListSheet.jsx";
import InventoryFormSheet from "../sheets/InventoryFormSheet.jsx";

// /popis: every stocktaking list in the shop, newest first.
export default function InventoryLists() {
  const navigate = useNavigate();
  const sheet = useSheet();
  const toast = useToast();
  const lists = useLoad(() => inventoryStore.list(), []);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const create = async (fields) => {
    setSaving(true);
    try {
      const created = await inventoryStore.create(fields);
      // replaces the form's history entry, so back from the list comes here
      navigate(`/popis/${created.id}`, { replace: true });
    } catch (e) {
      toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Popis nije napravljen.", action: { label: "Ponovi", run: () => create(fields) } });
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (list) => {
    setToDelete(list);
    sheet.open("delete-list");
  };

  const remove = async () => {
    setSaving(true);
    try {
      await inventoryStore.remove(toDelete.id);
      sheet.close();
      toast.show({ kind: "success", text: `Obrisan popis: ${inventoryTitle(toDelete)}` });
      lists.reload();
    } catch (e) {
      toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Popis nije obrisan.", action: { label: "Ponovi", run: remove } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(120px+env(safe-area-inset-bottom))]">
      <AppHeader title={<h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em] text-ink">Popis</h1>} />

      {lists.error && !lists.data ? (
        <LoadError text="Nema veze. Popisi nisu učitani." onRetry={lists.reload} />
      ) : lists.data === null ? (
        <p className="mt-8 text-center text-[15px] text-ink-3">Učitavanje…</p>
      ) : lists.data.length === 0 ? (
        <p className="mt-8 text-center text-[15px] text-ink-3">Još nema popisa. Napravi prvi za ovaj mesec.</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {lists.data.map((list) => (
            <ListCard key={list.id} to={`/popis/${list.id}`} title={inventoryTitle(list)} meta={itemCount(list.itemCount)} onLongPress={() => askDelete(list)} />
          ))}
        </ul>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto w-full max-w-[480px] bg-linear-to-b from-bg/0 to-bg to-40% px-5 pt-8 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <Button icon={Plus} onClick={() => sheet.open("new-list")} className="pointer-events-auto w-full">
            Novi popis
          </Button>
        </div>
      </div>

      <InventoryFormSheet
        open={sheet.name === "new-list"}
        onClose={sheet.close}
        heading="Novi popis"
        submitLabel="Napravi popis"
        saving={saving}
        onSubmit={create}
      />
      <ConfirmDeleteListSheet
        open={sheet.name === "delete-list" && toDelete !== null}
        onClose={sheet.close}
        kind="popis"
        name={toDelete ? inventoryTitle(toDelete) : ""}
        count={toDelete?.itemCount ?? 0}
        deleting={saving}
        onConfirm={remove}
      />
    </div>
  );
}
