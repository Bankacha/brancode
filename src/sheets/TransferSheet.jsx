import { ChevronRight, Plus } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import { itemCount } from "../lib/listFormat.js";
import { useLoad } from "../lib/useLoad.js";

// "Prenesi stavke": where the chosen items go — a new trebovanje (on top) or
// another existing one, newest first. The current one isn't offered.
export default function TransferSheet({ open, onClose, store, title, currentId, count, busy, onPickNew, onPick }) {
  const lists = useLoad(() => (open ? store.list() : Promise.resolve(null)), [open]);
  const targets = (lists.data ?? [])
    .filter((list) => list.id !== currentId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return (
    <BottomSheet open={open} onClose={onClose} dismissible={!busy}>
      <h2 className="font-display text-[24px] font-extrabold text-ink">Prenesi {itemCount(count)}</h2>
      <p className="-mt-1 text-[14px] text-ink-3">Stavke se kopiraju; ovo trebovanje ostaje kakvo je.</p>
      <Button variant="outline" size="md" icon={Plus} onClick={onPickNew} disabled={busy} className="w-full">
        Novo trebovanje sa izabranim stavkama
      </Button>
      {lists.error && !lists.data ? (
        <p className="text-[14px] text-danger-ink">Nema veze. Trebovanja nisu učitana.</p>
      ) : lists.data === null ? (
        <p className="text-[14px] text-ink-3">Učitavanje…</p>
      ) : (
        targets.length > 0 && (
          <ul className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
            {targets.map((list) => (
              <li key={list.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(list)}
                  className="flex w-full items-center gap-3 rounded-field border-[1.5px] border-border-soft bg-surface py-3 pr-3 pl-4 text-left transition-transform duration-100 active:scale-[.98] disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold text-ink">{title(list)}</span>
                    <span className="block text-[13px] text-ink-3">{itemCount(list.itemCount)}</span>
                  </span>
                  <ChevronRight size={20} className="shrink-0 text-ink-4" />
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </BottomSheet>
  );
}
