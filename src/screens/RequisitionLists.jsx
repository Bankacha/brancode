import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, WifiOff } from "lucide-react";
import { requisitionStore } from "../lib/requisitions.js";
import { isArchived, itemCount, requisitionTitle } from "../lib/listFormat.js";
import { useLoad } from "../lib/useLoad.js";
import { useSheet } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import AppHeader from "../components/AppHeader.jsx";
import Button from "../components/Button.jsx";
import ListCard from "../components/ListCard.jsx";
import LoadError from "../components/LoadError.jsx";
import ConfirmDeleteListSheet from "../sheets/ConfirmDeleteListSheet.jsx";
import RequisitionFormSheet from "../sheets/RequisitionFormSheet.jsx";

// Newest day first; on the same day, the one made last.
const byDate = (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

// /trebovanje: the last 20 days on top, older ones under "Arhiva" (kept
// until someone deletes them).
export default function RequisitionLists() {
  const navigate = useNavigate();
  const sheet = useSheet();
  const toast = useToast();
  const lists = useLoad(() => requisitionStore.list(), []);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const sorted = (lists.data ?? []).slice().sort(byDate);
  const recent = sorted.filter((list) => !isArchived(list.date));
  const archived = sorted.filter((list) => isArchived(list.date));

  const create = async (fields) => {
    setSaving(true);
    try {
      const created = await requisitionStore.create(fields);
      navigate(`/trebovanje/${created.id}`, { replace: true });
    } catch (e) {
      toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Trebovanje nije napravljeno.", action: { label: "Ponovi", run: () => create(fields) } });
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
      await requisitionStore.remove(toDelete.id);
      sheet.close();
      toast.show({ kind: "success", text: `Obrisano trebovanje: ${requisitionTitle(toDelete)}` });
      lists.reload();
    } catch (e) {
      toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Trebovanje nije obrisano.", action: { label: "Ponovi", run: remove } });
    } finally {
      setSaving(false);
    }
  };

  const cards = (items) => (
    <ul className="flex flex-col gap-2">
      {items.map((list) => (
        <ListCard key={list.id} to={`/trebovanje/${list.id}`} title={requisitionTitle(list)} meta={itemCount(list.itemCount)} onLongPress={() => askDelete(list)} />
      ))}
    </ul>
  );

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(120px+env(safe-area-inset-bottom))]">
      <AppHeader title={<h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em] text-ink">Trebovanje</h1>} />

      {lists.error && !lists.data ? (
        <LoadError text="Nema veze. Trebovanja nisu učitana." onRetry={lists.reload} />
      ) : lists.data === null ? (
        <p className="mt-8 text-center text-[15px] text-ink-3">Učitavanje…</p>
      ) : (
        <>
          <section className="mt-5">
            {recent.length > 0 ? cards(recent) : <p className="mt-3 text-center text-[15px] text-ink-3">Nema trebovanja u poslednjih 20 dana.</p>}
          </section>
          {archived.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-2 text-[13px] font-bold text-ink-3">Arhiva</h2>
              {cards(archived)}
            </section>
          )}
        </>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto w-full max-w-[480px] bg-linear-to-b from-bg/0 to-bg to-40% px-5 pt-8 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <Button icon={Plus} onClick={() => sheet.open("new-list")} className="pointer-events-auto w-full">
            Novo trebovanje
          </Button>
        </div>
      </div>

      <RequisitionFormSheet
        open={sheet.name === "new-list"}
        onClose={sheet.close}
        heading="Novo trebovanje"
        submitLabel="Napravi trebovanje"
        saving={saving}
        onSubmit={create}
      />
      <ConfirmDeleteListSheet
        open={sheet.name === "delete-list" && toDelete !== null}
        onClose={sheet.close}
        kind="trebovanje"
        name={toDelete ? requisitionTitle(toDelete) : ""}
        count={toDelete?.itemCount ?? 0}
        deleting={saving}
        onConfirm={remove}
      />
    </div>
  );
}
