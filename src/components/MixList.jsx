import { formatPrice } from "../lib/format.js";
import { copiesOf, mixChoice } from "../lib/printQueue.js";

const OPTIONS = [
  { format: "shelf", label: "Raf", on: "bg-ink text-bg" },
  { format: "fridge", label: "Friz", on: "bg-cold text-white" },
];

// Mix on the print preview (spec 2026-10-27, sketch B1): the list in its own
// order, each tag with a Raf | Friz switch. `rememberedOf(item)` is the
// format the database remembers for it, or null; an article with neither
// that nor a choice made here starts on the shelf, marked new.
export default function MixList({ queue, rememberedOf, loadFailed, onChoose }) {
  const choices = queue.map((item) => ({ item, ...mixChoice(item, rememberedOf(item)) }));
  const count = (format) => choices.filter((c) => c.format === format).reduce((sum, c) => sum + copiesOf(c.item), 0);
  return (
    <div className="mt-4 mb-4 flex flex-1 flex-col">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-surface-muted px-3 py-1 text-[13px] font-bold text-ink">{`Raf ${count("shelf")}`}</span>
        <span className="rounded-full bg-cold-bg px-3 py-1 text-[13px] font-bold text-cold-ink">{`Friz ${count("fridge")}`}</span>
      </div>
      {loadFailed && <p className="mt-2 text-[13px] text-danger-ink">Zapamćeni formati nisu učitani.</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {choices.map(({ item, format, isNew }) => (
          <li key={item.id} className="flex items-center gap-3 rounded-field border-[1.5px] border-border-soft bg-surface py-2 pr-2 pl-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-semibold text-ink">{item.name}</span>
                {isNew && <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] leading-4 font-bold text-white">NOVO</span>}
              </p>
              <p className="truncate font-mono text-[11px] text-ink-3">{`${item.barcode} · ${formatPrice(item.price)}`}</p>
            </div>
            <div role="radiogroup" aria-label={`Format za ${item.name}`} className="flex shrink-0 rounded-full bg-surface-muted p-[3px]">
              {OPTIONS.map((option) => (
                <button
                  key={option.format}
                  type="button"
                  role="radio"
                  aria-checked={format === option.format}
                  onClick={() => onChoose(item, option.format)}
                  className={`h-9 rounded-full px-3.5 text-[13px] font-bold transition-transform duration-100 active:scale-[.97] ${
                    format === option.format ? option.on : "text-ink-3"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
