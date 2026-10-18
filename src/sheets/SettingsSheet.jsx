import BottomSheet from "../components/BottomSheet.jsx";
import { useScannerReader } from "../lib/useScannerReader.js";
import { PDF_ORDERS, usePdfOrder } from "../lib/pdfOrder.js";

const READERS = [
  { key: "auto", label: "Automatski" },
  { key: "native", label: "Ugrađeni" },
  { key: "zxing", label: "zxing" },
];

// One choice out of a few, as a row of pills.
function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-xs font-semibold text-ink-3">{label}</p>
      <div className="flex rounded-full bg-surface-muted p-1">
        {options.map(({ key, label: text }) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
            className={`h-10 flex-1 rounded-full text-[14px] font-semibold ${value === key ? "bg-ink text-bg" : "text-ink-2"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

// Per-phone settings: the order of items in the list PDFs, and the
// temporary reader choice.
export default function SettingsSheet({ open, onClose }) {
  const [reader, setReader] = useScannerReader();
  const [pdfOrder, setPdfOrder] = usePdfOrder();
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="font-display text-[24px] font-extrabold text-ink">Podešavanja</h2>
      <p className="-mb-1 text-[15px] font-bold text-ink">Redosled stavki u PDF-u</p>
      <Segmented label="Popis" options={PDF_ORDERS} value={pdfOrder.popis} onChange={(order) => setPdfOrder("popis", order)} />
      <Segmented label="Trebovanje" options={PDF_ORDERS} value={pdfOrder.trebovanje} onChange={(order) => setPdfOrder("trebovanje", order)} />
      {/* Temporary, for comparing readers on the shop's phones; remove once one is chosen. */}
      <div className="mt-2">
        <Segmented label="Čitač barkoda (test)" options={READERS} value={reader} onChange={setReader} />
      </div>
    </BottomSheet>
  );
}
