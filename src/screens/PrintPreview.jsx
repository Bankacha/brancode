import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Apple, ArrowLeft, Download, LayoutGrid, MailCheck, Refrigerator, Send, WifiOff } from "lucide-react";
import { buildWorkbookBuffer, sheetFilename } from "../lib/priceTags.js";
import { downloadWorkbook } from "../lib/download.js";
import { sendSheetByEmail } from "../lib/email.js";
import { leaveScreen } from "../lib/navigation.js";
import { usePrintFormat } from "../lib/printFormat.js";
import { useToast } from "../components/Toast.jsx";
import Button from "../components/Button.jsx";

const FORMATS = [
  { key: "shelf", label: "Raf", icon: LayoutGrid },
  { key: "fridge", label: "Frižider", icon: Refrigerator },
  { key: "fruit", label: "Voće", icon: Apple },
];

// Handoff "06 · Format + pregled štampe" — the A4 preview comes in phase 3.
export default function PrintPreview({ queue }) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [format, setFormat] = usePrintFormat();
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // blocks a second tap before the re-render disables the button

  if (queue.length === 0) return <Navigate to="/" replace />;

  const send = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    toast.show({ kind: "loading", text: "Šaljem na mejl…" });
    try {
      await sendSheetByEmail(sheetFilename(format), await buildWorkbookBuffer(queue, format));
      toast.show({ kind: "success", icon: MailCheck, text: "Poslato na mejl radnje" });
    } catch (e) {
      console.error("send email failed", e);
      toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Nije poslato.", action: { label: "Ponovi", run: send } });
    }
    sendingRef.current = false;
    setSending(false);
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
        <h1 className="flex-1 font-display text-[24px] font-extrabold text-ink">Pregled štampe</h1>
        <span className="text-[13px] font-medium text-ink-3">{queue.length} kom</span>
      </header>

      <div className="mt-4 flex rounded-full bg-surface-muted p-[5px]">
        {FORMATS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={format === key}
            onClick={() => setFormat(key)}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[15px] font-semibold transition-transform duration-100 active:scale-[.97] ${
              format === key ? "bg-ink text-bg" : "text-ink-2"
            }`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <div className="flex gap-2.5">
        <Button variant="accent" icon={Send} onClick={send} disabled={sending} className="flex-1">
          Pošalji
        </Button>
        <Button variant="outline" icon={Download} onClick={() => downloadWorkbook(queue, format)} className="flex-1">
          Excel
        </Button>
      </div>
    </div>
  );
}
