import { Keyboard, Printer, ScanBarcode } from "lucide-react";

// The bottom bar of a Popis or Trebovanje, like the home screen's: type a
// code, scan (the big button), export the PDF.
export default function ListBottomBar({ onType, onScan, onExport, canExport }) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto flex h-[calc(140px+env(safe-area-inset-bottom))] w-full max-w-[480px] items-center justify-center gap-7 bg-linear-to-b from-bg/0 to-bg to-40% pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          aria-label="Ručni unos"
          onClick={onType}
          className="pointer-events-auto flex size-[52px] items-center justify-center rounded-full border-[1.5px] border-border-soft bg-surface text-ink transition-transform duration-100 active:scale-[.97]"
        >
          <Keyboard size={22} />
        </button>
        <button
          type="button"
          aria-label="Skeniraj"
          onClick={onScan}
          className="pointer-events-auto flex size-[84px] items-center justify-center rounded-full bg-accent text-white shadow-scan transition-transform duration-100 active:scale-[.97]"
        >
          <ScanBarcode size={36} />
        </button>
        <button
          type="button"
          aria-label="Izvoz"
          disabled={!canExport}
          onClick={onExport}
          className="pointer-events-auto flex size-[52px] items-center justify-center rounded-full bg-ink text-bg transition-transform duration-100 active:scale-[.97] disabled:opacity-50"
        >
          <Printer size={22} />
        </button>
      </div>
    </nav>
  );
}
