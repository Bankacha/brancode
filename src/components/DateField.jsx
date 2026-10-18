import { useId } from "react";
import { CalendarDays } from "lucide-react";
import { formatDate } from "../lib/listFormat.js";

// A date as dd.mm.yyyy whatever the browser's own date format is (an English
// Chrome would show 10/18/2026). The native date input lies invisible over
// the field, so a tap still opens the phone's calendar; the value stays ISO.
export default function DateField({ label, value, onChange, className = "" }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`group relative flex items-center gap-3 rounded-field border-[1.5px] border-border bg-surface px-4 py-3 focus-within:border-accent focus-within:shadow-[0_0_0_0.5px_var(--color-accent)] ${className}`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-medium text-ink-3 group-focus-within:font-semibold group-focus-within:text-accent">{label}</span>
        <span className={`text-[17px] font-medium ${value ? "text-ink" : "text-ink-4"}`}>{value ? formatDate(value) : "dd.mm.gggg"}</span>
      </span>
      <CalendarDays size={18} className="shrink-0 text-ink-3" />
      <input
        id={id}
        type="date"
        aria-label={label}
        value={value}
        onChange={onChange}
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}
