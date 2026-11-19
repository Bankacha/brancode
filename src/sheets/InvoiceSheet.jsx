import { FileDown } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import { belgradeDateOf, deadlineText, decisionNote, formatAmount, isPending, responseDeadline, sentNote, statusLabel } from "../lib/efakturaRules.js";
import { formatDate } from "../lib/listFormat.js";

const day = (iso) => (iso ? `${formatDate(iso)}.` : "—");

function Row({ label, children }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right font-semibold text-ink">{children}</dd>
    </>
  );
}

// One incoming invoice: what SEF says about it, who decided on it through the
// app and where it was sent, its PDF, and — while it waits — accept / reject.
export default function InvoiceSheet({ open, onClose, invoice, todayIso, acceptEnabled, busy, onAccept, onReject, onPdf }) {
  if (!invoice) return <BottomSheet open={false} onClose={onClose} />;
  const deadline = responseDeadline(invoice, todayIso);
  const money = (n) => (n === null || n === undefined ? "—" : formatAmount(n, invoice.currency));
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-[22px] leading-tight font-extrabold text-ink">{invoice.supplier}</h2>
          {invoice.supplierPib && <p className="font-mono text-[12px] text-ink-3">PIB {invoice.supplierPib}</p>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
          <Row label="Broj fakture">{invoice.number || "—"}</Row>
          <Row label="Primljena">{day(belgradeDateOf(invoice.receivedAt))}</Row>
          <Row label="Valuta">{day(invoice.dueDate)}</Row>
          <Row label="Bez PDV-a">{money(invoice.amountWithoutVat)}</Row>
          <Row label="PDV">{money(invoice.vat)}</Row>
          <Row label="Ukupno">{money(invoice.amount)}</Row>
          <Row label="Status">{statusLabel(invoice.status)}</Row>
        </dl>
        {deadline && <p className={`text-[14px] ${deadline.kind !== "days" || deadline.urgent ? "font-bold text-accent" : "text-ink-2"}`}>{`Rok za odgovor: ${deadlineText(deadline)}`}</p>}
        {invoice.decision ? (
          <p className="text-[14px] text-ink-2">{decisionNote(invoice.decision)}</p>
        ) : (
          invoice.status === "Approved" && <p className="text-[14px] text-ink-2">Prihvaćena na SEF-u</p>
        )}
        {invoice.decision?.comment && <p className="text-[14px] text-ink-2">{`Razlog: ${invoice.decision.comment}`}</p>}
        {invoice.send?.state === "sent" && <p className="text-[14px] text-ink-2">{sentNote(invoice.send)}</p>}

        <Button variant="outline" size="md" icon={FileDown} onClick={onPdf} className="w-full">
          Otvori PDF
        </Button>
        {isPending(invoice) && (
          <div className="flex flex-col gap-2">
            {!acceptEnabled && <p className="text-center text-[13px] font-semibold text-ink-3">Prihvatanje još nije uključeno</p>}
            <div className="flex gap-2">
              <Button variant="outline" disabled={!acceptEnabled || busy} onClick={onReject} className="flex-1">
                Odbij
              </Button>
              <Button variant="accent" disabled={!acceptEnabled || busy} onClick={onAccept} className="flex-1">
                Prihvati
              </Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
