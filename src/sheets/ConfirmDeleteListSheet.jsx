import { Trash2 } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import { plural } from "../lib/plural.js";

export const itemCount = (n) => plural(n, `${n} stavka`, `${n} stavke`, `${n} stavki`);

// Deleting a whole Popis or Trebovanje: it's shared by every phone and can't
// be undone, so the sheet names it and says how many items go with it.
export default function ConfirmDeleteListSheet({ open, onClose, kind, name, count, deleting, onConfirm }) {
  return (
    <BottomSheet open={open} onClose={onClose} dismissible={!deleting}>
      <span className="flex size-14 items-center justify-center rounded-field bg-danger-bg text-accent">
        <Trash2 size={24} />
      </span>
      <h2 className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-ink">
        Obrisati {kind} „{name}“?
      </h2>
      <p className="text-[15px] leading-normal text-ink-2">
        {count > 0 ? `Briše se i ${itemCount(count)}. ` : ""}Briše se sa svih telefona i ne može da se vrati.
      </p>
      <Button variant="accent" onClick={onConfirm} disabled={deleting} className="mt-1 w-full">
        Obriši {kind}
      </Button>
      <Button variant="muted" onClick={onClose} disabled={deleting} className="w-full">
        Zadrži
      </Button>
    </BottomSheet>
  );
}
