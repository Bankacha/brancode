import { useEffect, useRef } from "react";
import { ArrowLeft, Check, Delete } from "lucide-react";
import { eraseDigit, typeDigit } from "../lib/manualCode.js";
import Button from "./Button.jsx";

const GUIDE_DIGITS = 13; // EAN-13; shorter and longer codes are fine too

function Key({ label, children, onPress }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className="flex h-[60px] items-center justify-center rounded-field border-[1.5px] border-border-soft bg-surface font-display text-[26px] font-bold text-ink transition-transform duration-100 active:scale-[.97]"
    >
      {children ?? label}
    </button>
  );
}

// Handoff "05 · Ručni unos", the keypad screen: typing a barcode for price
// tags or for a list. A physical keyboard works too (desktop) while
// `listening` — off while a sheet's fields have the keyboard.
export default function BarcodeKeypad({ code, onCodeChange, onSubmit, onBack, listening, children }) {
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    if (!listening) return;
    const onKey = (e) => {
      if (e.key === "Backspace") onCodeChange(eraseDigit);
      else if (e.key === "Enter") submitRef.current();
      else onCodeChange((c) => typeDigit(c, e.key));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, onCodeChange]);

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(34px+env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Nazad"
          onClick={onBack}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink transition-transform duration-100 active:scale-[.97]"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-[24px] font-extrabold text-ink">Upiši barkod</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center py-8">
        <div className="flex h-[44px] items-center">
          <span data-testid="code" className="font-mono text-[34px] tracking-[0.06em] text-ink">
            {code}
          </span>
          <span className="ml-0.5 h-[38px] w-[3px] animate-pulse rounded-full bg-accent" />
        </div>
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: GUIDE_DIGITS }, (_, i) => (
            <span key={i} className={`h-1 w-2.5 rounded-xs ${i < code.length ? "bg-ink" : "bg-border"}`} />
          ))}
        </div>
        <p className="mt-3 text-[13px] text-ink-3">{`${code.length} od ${GUIDE_DIGITS} cifara · EAN, UPC ili interna šifra`}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} label={d} onPress={() => onCodeChange((c) => typeDigit(c, d))} />
        ))}
        <Key label="Obriši" onPress={() => onCodeChange(eraseDigit)}>
          <Delete size={26} />
        </Key>
        <Key label="0" onPress={() => onCodeChange((c) => typeDigit(c, "0"))} />
        <Key label="Potvrdi" onPress={onSubmit}>
          <Check size={26} />
        </Key>
      </div>
      <Button variant="dark" disabled={!code} onClick={onSubmit} className="mt-3 w-full">
        Nastavi
      </Button>

      {children}
    </div>
  );
}
