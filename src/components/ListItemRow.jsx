import { X } from "lucide-react";
import { useLongPress } from "../lib/useLongPress.js";

// One item on a Popis or Trebovanje: name, a detail line (barcode, price),
// the quantity on the right. Long-press edits, X removes (as on the price list).
export default function ListItemRow({ name, detail, quantity, onLongPress, onRemove }) {
  const press = useLongPress(onLongPress);
  return (
    <li
      {...press}
      className="flex select-none items-center gap-3 rounded-field border-[1.5px] border-border-soft bg-surface py-2.5 pr-3 pl-4 [-webkit-touch-callout:none]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{name}</p>
        {detail && <p className="truncate font-mono text-[11px] text-ink-3">{detail}</p>}
      </div>
      {quantity !== null && <span className="shrink-0 font-display text-[22px] font-extrabold text-ink">{quantity}</span>}
      <button
        type="button"
        aria-label="Ukloni"
        onClick={onRemove}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-4 transition-transform duration-100 active:scale-[.97]"
      >
        <X size={18} />
      </button>
    </li>
  );
}
