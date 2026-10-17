import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, Check, Delete, WifiOff } from "lucide-react";
import { eraseDigit, typeDigit } from "../lib/manualCode.js";
import { formatPrice } from "../lib/format.js";
import { finishScreen, leaveScreen } from "../lib/navigation.js";
import { usePrintFormat } from "../lib/printFormat.js";
import { useSheet } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import Button from "../components/Button.jsx";
import EditSheet from "../sheets/EditSheet.jsx";

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

// Handoff "05 · Ručni unos". "Nastavi" opens the edit sheet over this screen.
export default function ManualEntry({ editor }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sheet = useSheet();
  const toast = useToast();
  const [format] = usePrintFormat();
  const [code, setCode] = useState("");
  const firstPage = useRef(location.key === "default"); // nothing in-app behind this screen

  const submit = () => {
    if (!code) return;
    editor.open(code);
    sheet.open("edit");
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // A physical keyboard works too (desktop), but not while the sheet's fields have it.
  useEffect(() => {
    if (sheet.name) return;
    const onKey = (e) => {
      if (e.key === "Backspace") setCode(eraseDigit);
      else if (e.key === "Enter") submitRef.current();
      else setCode((c) => typeDigit(c, e.key));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet.name]);

  // After a refresh the history can still say "edit" without the editor's data.
  useEffect(() => {
    if (sheet.name === "edit" && editor.barcode === null) navigate(".", { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "Sačuvaj i upiši sledeći" stays here for the next code; "Sačuvaj i
  // zatvori" leaves for home.
  const save = async (then) => {
    const saved = await editor.save();
    if (!saved) {
      toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Nije sačuvano.", action: { label: "Ponovi", run: () => saveRef.current(then) } });
      return;
    }
    toast.show({ kind: "success", icon: Check, text: `Dodato: ${saved.name}`, detail: formatPrice(saved.price) });
    if (then === "next") {
      sheet.close();
      setCode("");
    } else {
      finishScreen(navigate, firstPage.current);
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  const closeEdit = () => {
    sheet.close();
    editor.close();
  };

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(34px+env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Nazad"
          onClick={() => leaveScreen(navigate, location)}
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
          <Key key={d} label={d} onPress={() => setCode((c) => typeDigit(c, d))} />
        ))}
        <Key label="Obriši" onPress={() => setCode(eraseDigit)}>
          <Delete size={26} />
        </Key>
        <Key label="0" onPress={() => setCode((c) => typeDigit(c, "0"))} />
        <Key label="Potvrdi" onPress={submit}>
          <Check size={26} />
        </Key>
      </div>
      <Button variant="dark" disabled={!code} onClick={submit} className="mt-3 w-full">
        Nastavi
      </Button>

      <EditSheet
        editor={editor}
        open={sheet.name === "edit" && editor.barcode !== null}
        onClose={closeEdit}
        format={format}
        source="manual"
        onSaveNext={() => save("next")}
        onFinish={() => save("finish")}
      />
    </div>
  );
}
