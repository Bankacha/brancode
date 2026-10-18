import { LogOut } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";

const READERS = [
  { key: "auto", label: "Automatski" },
  { key: "native", label: "Ugrađeni" },
  { key: "zxing", label: "zxing" },
];

export default function MenuSheet({ open, onClose, email, onSignOut, reader, onReaderChange }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <p className="font-mono text-xs text-ink-3">{email}</p>
      {/* Temporary, for comparing readers on the shop's phones; remove once one is chosen. */}
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink-3">Čitač barkoda (test)</p>
        <div className="flex rounded-full bg-surface-muted p-1">
          {READERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={reader === key}
              onClick={() => onReaderChange(key)}
              className={`h-9 flex-1 rounded-full text-[13px] font-semibold ${reader === key ? "bg-ink text-bg" : "text-ink-2"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Button variant="text" size="md" icon={LogOut} onClick={onSignOut} className="w-full">
        Odjavi se
      </Button>
    </BottomSheet>
  );
}
