import { useId } from "react";
import BottomSheet from "../components/BottomSheet.jsx";
import { useScannerReader } from "../lib/useScannerReader.js";
import { PDF_ORDERS, usePdfOrder } from "../lib/pdfOrder.js";
import { version } from "../../package.json";

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

function Section({ title, hint, children }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h3 id={id} className="text-[16px] font-bold text-ink">
          {title}
        </h3>
        {hint && <p className="text-[13px] text-ink-3">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// Per-phone settings, grouped by what they affect, and the app's version
// (from package.json, bumped with every deploy).
export default function SettingsSheet({ open, onClose }) {
  const [reader, setReader] = useScannerReader();
  const [pdfOrder, setPdfOrder] = usePdfOrder();
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="font-display text-[24px] font-extrabold text-ink">Podešavanja</h2>
      <Section title="Izvoz u PDF" hint="Redosled stavki u PDF-u, kad se preuzme ili pošalje mejlom.">
        <Segmented label="Popis" options={PDF_ORDERS} value={pdfOrder.popis} onChange={(order) => setPdfOrder("popis", order)} />
        <Segmented label="Trebovanje" options={PDF_ORDERS} value={pdfOrder.trebovanje} onChange={(order) => setPdfOrder("trebovanje", order)} />
      </Section>
      <div className="h-px bg-border-soft" />
      <Section title="Skeniranje">
        {/* Temporary, for comparing readers on the shop's phones; remove once one is chosen. */}
        <Segmented label="Čitač barkoda (test)" options={READERS} value={reader} onChange={setReader} />
      </Section>
      <div className="h-px bg-border-soft" />
      <p className="text-center font-mono text-xs text-ink-3">Verzija {version}</p>
    </BottomSheet>
  );
}
