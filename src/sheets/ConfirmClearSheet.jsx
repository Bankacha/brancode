import { Trash2 } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import { plural } from "../lib/plural.js";

// Handoff "08 · Potvrda brisanja".
export default function ConfirmClearSheet({ open, onClose, count, onConfirm }) {
  const what = plural(count, `${count} cenovnik`, `sva ${count} cenovnika`, `svih ${count} cenovnika`);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <span className="flex size-14 items-center justify-center rounded-field bg-danger-bg text-accent">
        <Trash2 size={24} />
      </span>
      <h2 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-ink">Obrisati {what}?</h2>
      <p className="text-[15px] leading-normal text-ink-2">Lista se briše samo sa ovog telefona. Cene u bazi ostaju.</p>
      <Button variant="accent" onClick={onConfirm} className="mt-1 w-full">
        Obriši sve
      </Button>
      <Button variant="muted" onClick={onClose} className="w-full">
        Zadrži listu
      </Button>
    </BottomSheet>
  );
}
