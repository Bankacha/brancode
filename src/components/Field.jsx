import { forwardRef, useId } from "react";

// Label above the value inside one white box; focus turns the border and
// label accent (handoff "Polje").
const Field = forwardRef(function Field({ label, suffix, className = "", inputClassName = "", ...inputProps }, ref) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`group flex items-center gap-3 rounded-field border-[1.5px] border-border bg-surface px-4 py-3 focus-within:border-accent focus-within:shadow-[0_0_0_0.5px_var(--color-accent)] ${className}`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-medium text-ink-3 group-focus-within:font-semibold group-focus-within:text-accent">{label}</span>
        <input ref={ref} id={id} className={`w-full bg-transparent text-[17px] font-medium text-ink outline-none ${inputClassName}`} {...inputProps} />
      </span>
      {suffix && <span className="shrink-0 text-[15px] font-medium text-ink-3">{suffix}</span>}
    </label>
  );
});

export default Field;
