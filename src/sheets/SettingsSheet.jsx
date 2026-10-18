import BottomSheet from "../components/BottomSheet.jsx";
import { useScannerReader } from "../lib/useScannerReader.js";

const READERS = [
  { key: "auto", label: "Automatski" },
  { key: "native", label: "Ugrađeni" },
  { key: "zxing", label: "zxing" },
];

export default function SettingsSheet({ open, onClose }) {
  const [reader, setReader] = useScannerReader();
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="font-display text-[24px] font-extrabold text-ink">Podešavanja</h2>
      {/* Temporary, for comparing readers on the shop's phones; remove once one is chosen. */}
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink-3">Čitač barkoda (test)</p>
        <div className="flex rounded-full bg-surface-muted p-1">
          {READERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={reader === key}
              onClick={() => setReader(key)}
              className={`h-10 flex-1 rounded-full text-[14px] font-semibold ${reader === key ? "bg-ink text-bg" : "text-ink-2"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
