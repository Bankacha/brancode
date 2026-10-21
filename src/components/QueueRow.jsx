import { X } from "lucide-react";
import { formatPrice } from "../lib/format.js";
import { copiesOf } from "../lib/printQueue.js";
import { useLongPress } from "../lib/useLongPress.js";

// One print-list row (handoff 02 "Red"). Long-press edits, X removes;
// "×3" before the price when the tag prints more than once.
export default function QueueRow({ item, tone, onLongPress, onRemove }) {
  const press = useLongPress(onLongPress);
  const check = tone === "check";
  const copies = copiesOf(item);
  return (
    <li
      {...press}
      className={`flex select-none items-center gap-3 rounded-field py-2.5 pr-3 pl-4 [-webkit-touch-callout:none] ${
        check ? "bg-danger-bg" : "border-[1.5px] border-border-soft bg-surface"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{item.name}</p>
        <p className={`font-mono text-[11px] ${check ? "text-danger-ink" : "text-ink-3"}`}>{item.barcode}</p>
      </div>
      {copies > 1 && <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-2">{`×${copies}`}</span>}
      <span className="shrink-0 font-display text-[22px] font-extrabold text-ink">{formatPrice(item.price)}</span>
      <button
        type="button"
        aria-label="Ukloni"
        onClick={onRemove}
        className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-transform duration-100 active:scale-[.97] ${
          check ? "text-danger-ink/60" : "text-ink-4"
        }`}
      >
        <X size={18} />
      </button>
    </li>
  );
}
