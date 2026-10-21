import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import Button from "./Button.jsx";
import { MAX_COPIES } from "../lib/printQueue.js";
import { plural } from "../lib/plural.js";

const stepClass =
  "flex size-14 items-center justify-center rounded-full bg-surface-muted text-ink transition-transform duration-100 active:scale-[.97] disabled:opacity-40 disabled:active:scale-100";

// "Broj kopija": a small window over the price sheet. − and + change a draft;
// only "U redu" hands it back, so a tap outside or Escape changes nothing.
function Panel({ value, onConfirm, onClose }) {
  const [draft, setDraft] = useState(value);

  // Captured on window before the sheet's own Escape handler, so Escape
  // closes only this window, not the sheet under it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-8">
      <div data-testid="copies-scrim" className="absolute inset-0 bg-scrim/80" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="copies-title" className="relative flex w-full max-w-[320px] flex-col gap-4 rounded-card bg-bg p-5">
        <h2 id="copies-title" className="text-center font-display text-[22px] font-extrabold text-ink">
          Broj kopija
        </h2>
        <div className="flex items-center justify-center gap-5">
          <button type="button" aria-label="Manje kopija" disabled={draft <= 1} onClick={() => setDraft(draft - 1)} className={stepClass}>
            <Minus size={22} />
          </button>
          <output className="w-16 text-center font-display text-[44px] leading-none font-extrabold text-ink">{draft}</output>
          <button type="button" aria-label="Više kopija" disabled={draft >= MAX_COPIES} onClick={() => setDraft(draft + 1)} className={stepClass}>
            <Plus size={22} />
          </button>
        </div>
        <p className="text-center text-[13px] text-ink-3">{`Cenovnik se štampa ${draft} ${plural(draft, "put", "puta", "puta")}`}</p>
        <Button variant="accent" onClick={() => onConfirm(draft)} className="w-full">
          U redu
        </Button>
      </div>
    </div>
  );
}

// Mounted fresh on every opening, so the draft starts from the current count.
export default function CopiesDialog({ open, value, onConfirm, onClose }) {
  return open ? <Panel value={value} onConfirm={onConfirm} onClose={onClose} /> : null;
}
