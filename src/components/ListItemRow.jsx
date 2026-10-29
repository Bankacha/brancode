import { Square, SquareCheck, X } from "lucide-react";
import { useLongPress } from "../lib/useLongPress.js";

// One item on a Popis or Trebovanje: name, a detail line (barcode, price),
// small badges under it (a trebovanje's leaflets: filled while one runs,
// outlined when it is still to come), the quantity on the right. Long-press
// edits, X removes (as on the price list). While picking items to copy
// (`selectable`), a tap toggles it.
export default function ListItemRow({ name, detail, badges = [], quantity, onLongPress, onRemove, selectable = false, selected = false, onToggle }) {
  const press = useLongPress(onLongPress);
  const text = (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[15px] font-semibold text-ink">{name}</p>
      {detail && <p className="truncate font-mono text-[11px] text-ink-3">{detail}</p>}
      {badges.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-1">
          {badges.map(({ text, upcoming }) => (
            <span
              key={text}
              className={`rounded-full px-1.5 text-[10px] leading-4 font-bold ${upcoming ? "border border-accent text-accent" : "bg-accent text-white"}`}
            >
              {text}
            </span>
          ))}
        </p>
      )}
    </div>
  );
  const amount = quantity !== null && <span className="shrink-0 font-display text-[22px] font-extrabold text-ink">{quantity}</span>;

  if (selectable) {
    return (
      <li>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={name}
          onClick={onToggle}
          className={`flex w-full items-center gap-3 rounded-field border-[1.5px] py-2.5 pr-4 pl-3 text-left transition-transform duration-100 active:scale-[.98] ${
            selected ? "border-accent bg-surface" : "border-border-soft bg-surface"
          }`}
        >
          {selected ? <SquareCheck size={22} className="shrink-0 text-accent" /> : <Square size={22} className="shrink-0 text-ink-4" />}
          {text}
          {amount}
        </button>
      </li>
    );
  }

  return (
    <li
      {...press}
      className="flex select-none items-center gap-3 rounded-field border-[1.5px] border-border-soft bg-surface py-2.5 pr-3 pl-4 [-webkit-touch-callout:none]"
    >
      {text}
      {amount}
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
