import { Info } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import { plural } from "../lib/plural.js";

function Stat({ value, label, className }) {
  return (
    <div className={`rounded-field p-3.5 ${className}`}>
      <p className="font-display text-[36px] leading-none font-extrabold">{value}</p>
      <p className="mt-1.5 text-[13px] leading-snug font-medium">{label}</p>
    </div>
  );
}

// Handoff "07 · Uvoz akcijskog lifleta", shown once the PDF has been read.
export default function LeafletImportSheet({ open, onClose, fileName, matches, queueLength, saving, onConfirm }) {
  const n = matches.length;
  const inDb = matches.filter((m) => m.existing).length;
  return (
    <BottomSheet open={open} onClose={onClose} dismissible={!saving}>
      <div>
        <h2 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-ink">
          {`Pročitano ${n} ${plural(n, "artikal", "artikla", "artikala")}`}
        </h2>
        <p className="mt-1 font-mono text-xs text-ink-3">{fileName}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat value={inDb} label="u bazi, cena se ažurira" className="bg-success-bg text-success-ink" />
        <Stat value={n - inDb} label="nisu u bazi, samo u listu" className="bg-danger-bg text-danger-ink" />
      </div>
      {queueLength > 0 && (
        <div className="flex gap-2.5 rounded-field bg-surface-muted p-3.5 text-[14px] leading-snug text-ink-2">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p>{`Trenutna lista (${queueLength}) biće zamenjena. Nepotrebne artikle ukloni pre štampe.`}</p>
        </div>
      )}
      <Button variant="dark" disabled={saving} onClick={onConfirm} className="mt-1 w-full">
        {queueLength > 0 ? "Zameni listu i uvezi" : "Uvezi u listu"}
      </Button>
      <Button variant="text" size="md" disabled={saving} onClick={onClose} className="w-full">
        Otkaži
      </Button>
    </BottomSheet>
  );
}
