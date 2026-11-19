import { Square, SquareCheck } from "lucide-react";
import { deadlineText, formatAmount, responseDeadline, sentNote, statusLabel } from "../lib/efakturaRules.js";

// One incoming invoice: supplier and number, the amount and its due date on
// the right, and under it the response deadline (highlighted when close, past or
// after SEF's reminder), its status, or where it was sent. The checkbox is a
// button of its own; a tap on the rest opens the invoice.
export default function InvoiceRow({ invoice, todayIso, selectable = false, selected = false, onToggle, onOpen, showStatus = false, showSent = false }) {
  const label = `${invoice.supplier}, ${invoice.number}`;
  const deadline = !showStatus && responseDeadline(invoice, todayIso);
  const pressing = deadline && (deadline.kind !== "days" || deadline.urgent);
  return (
    <li className={`flex items-stretch rounded-field border-[1.5px] bg-surface ${selected ? "border-accent" : "border-border-soft"}`}>
      {selectable && (
        <button type="button" role="checkbox" aria-checked={selected} aria-label={`Izaberi: ${label}`} onClick={onToggle} className="flex shrink-0 items-center pr-1 pl-3">
          {selected ? <SquareCheck size={22} className="text-accent" /> : <Square size={22} className="text-ink-4" />}
        </button>
      )}
      <button
        type="button"
        aria-label={label}
        onClick={onOpen}
        className={`flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 text-left transition-transform duration-100 active:scale-[.99] ${selectable ? "pl-2" : "pl-4"}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{invoice.supplier}</span>
          <span className="block truncate font-mono text-[11px] text-ink-3">{invoice.number}</span>
          {showStatus && <span className="mt-1 inline-block rounded-full bg-surface-muted px-2 text-[11px] leading-5 font-semibold text-ink-2">{statusLabel(invoice.status)}</span>}
          {deadline && <span className={`mt-0.5 block text-[12px] ${pressing ? "font-bold text-accent" : "text-ink-3"}`}>{deadlineText(deadline)}</span>}
          {showSent && invoice.send?.state === "sent" && <span className="mt-0.5 block truncate text-[12px] text-ink-3">{sentNote(invoice.send)}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="font-display text-[16px] font-extrabold text-ink">{formatAmount(invoice.amount, invoice.currency)}</span>
          {invoice.dueDate && <span className="text-[11px] text-ink-3">{`Valuta ${invoice.dueDate.slice(8, 10)}.${invoice.dueDate.slice(5, 7)}.`}</span>}
        </span>
      </button>
    </li>
  );
}
