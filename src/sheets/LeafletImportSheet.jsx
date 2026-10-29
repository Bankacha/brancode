import { useState } from "react";
import { CircleAlert, Info } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import DateField from "../components/DateField.jsx";
import { formatDate } from "../lib/listFormat.js";
import { plural } from "../lib/plural.js";

function Stat({ value, label, className }) {
  return (
    <div className={`rounded-field p-3.5 ${className}`}>
      <p className="font-display text-[36px] leading-none font-extrabold">{value}</p>
      <p className="mt-1.5 text-[13px] leading-snug font-medium">{label}</p>
    </div>
  );
}

// What the chosen period means, and whether it can be imported. The first
// three block the import.
const periodNote = ({ dateFrom, dateTo, found, today }) => {
  if (!dateFrom || !dateTo) return { blocks: true, text: found ? "Upiši oba datuma akcije." : "Datumi akcije nisu pronađeni u PDF-u. Upiši ih." };
  if (dateTo < dateFrom) return { blocks: true, text: "Kraj akcije ne može biti pre početka." };
  if (dateTo < today) return { blocks: true, text: "Ova akcija je već istekla." };
  if (dateFrom > today) return { blocks: false, text: `Akcijske cene se upisuju u bazu ${formatDate(dateFrom)}. ujutru.` };
  return { blocks: false, text: "Akcijske cene se upisuju u bazu odmah." };
};

// Handoff "07 · Uvoz akcijskog lifleta", shown once the PDF has been read.
// The promotion's period comes from the PDF and can be corrected here.
// sameLeaflet: an open leaflet this one may be with corrected dates
// (findSameLeaflet); then the sheet asks before importing and onAnswer(isSame)
// carries on.
export default function LeafletImportSheet({ open, onClose, fileName, leafletName, matches, period, today, queueLength, saving, onConfirm, sameLeaflet = null, onAnswer }) {
  const n = matches.length;
  const inDb = matches.filter((m) => m.existing).length;
  const [dateFrom, setDateFrom] = useState(period?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(period?.dateTo ?? "");
  const note = periodNote({ dateFrom, dateTo, found: Boolean(period), today });
  return (
    <BottomSheet open={open} onClose={onClose} dismissible={!saving}>
      <div>
        <h2 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-ink">
          {`Pročitano ${n} ${plural(n, "artikal", "artikla", "artikala")}`}
        </h2>
        {leafletName && <p className="mt-1 text-[15px] font-semibold text-ink-2">{leafletName}</p>}
        <p className="mt-1 font-mono text-xs text-ink-3">{fileName}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <DateField label="Akcija od" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <DateField label="Akcija do" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>
      <div className={`flex gap-2.5 rounded-field p-3.5 text-[14px] leading-snug ${note.blocks ? "bg-danger-bg text-danger-ink" : "bg-surface-muted text-ink-2"}`}>
        {note.blocks ? <CircleAlert size={18} className="mt-0.5 shrink-0" /> : <Info size={18} className="mt-0.5 shrink-0" />}
        <div>
          <p>{note.text}</p>
          <p>Posle isteka akcije redovne cene se vraćaju same.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat value={inDb} label={dateTo ? `u bazi, akcijska cena do ${formatDate(dateTo).slice(0, 6)}` : "u bazi, akcijska cena"} className="bg-success-bg text-success-ink" />
        <Stat value={n - inDb} label="nisu u bazi, samo u listu" className="bg-danger-bg text-danger-ink" />
      </div>
      {queueLength > 0 && (
        <div className="flex gap-2.5 rounded-field bg-surface-muted p-3.5 text-[14px] leading-snug text-ink-2">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p>{`Trenutna lista (${queueLength}) biće zamenjena. Nepotrebne artikle ukloni pre štampe.`}</p>
        </div>
      )}
      {sameLeaflet ? (
        <>
          <div className="rounded-field bg-surface-muted p-3.5 text-[14px] leading-snug text-ink">
            <p>{`Već postoji liflet „${sameLeaflet.name}“ (${formatDate(sameLeaflet.dateFrom)}. – ${formatDate(sameLeaflet.dateTo)}.).`}</p>
            <p className="mt-1 font-semibold">Da li je ovo isti liflet sa ispravljenim datumima?</p>
          </div>
          <Button variant="dark" disabled={saving} onClick={() => onAnswer(true)} className="mt-1 w-full">
            Da, ispravi datume
          </Button>
          <Button variant="outline" disabled={saving} onClick={() => onAnswer(false)} className="w-full">
            Ne, ovo je novi liflet
          </Button>
        </>
      ) : (
        <Button variant="dark" disabled={saving || note.blocks} onClick={() => onConfirm({ dateFrom, dateTo })} className="mt-1 w-full">
          {queueLength > 0 ? "Zameni listu i uvezi" : "Uvezi u listu"}
        </Button>
      )}
      <Button variant="text" size="md" disabled={saving} onClick={onClose} className="w-full">
        Otkaži
      </Button>
    </BottomSheet>
  );
}
