import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Check, WifiOff } from "lucide-react";
import { formatPrice } from "../lib/format.js";
import { finishScreen, leaveScreen, putHomeBehind } from "../lib/navigation.js";
import { usePrintFormat } from "../lib/printFormat.js";
import { useSheet } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import BarcodeKeypad from "../components/BarcodeKeypad.jsx";
import EditSheet from "../sheets/EditSheet.jsx";

// Handoff "05 · Ručni unos". "Nastavi" opens the edit sheet over this screen.
export default function ManualEntry({ editor }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sheet = useSheet();
  const toast = useToast();
  const [format] = usePrintFormat();
  const [code, setCode] = useState("");

  const submit = () => {
    if (!code) return;
    editor.open(code);
    sheet.open("edit");
  };

  // Opened as the first page: put home behind this screen (once — StrictMode
  // runs effects twice).
  const homeBehind = useRef(false);
  useEffect(() => {
    if (homeBehind.current) return;
    homeBehind.current = true;
    putHomeBehind(navigate, location);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      finishScreen(navigate, sheet.isOpen());
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  const closeEdit = () => {
    sheet.close();
    editor.close();
  };

  return (
    <BarcodeKeypad code={code} onCodeChange={setCode} onSubmit={submit} onBack={() => leaveScreen(navigate, location)} listening={!sheet.name}>
      <EditSheet
        editor={editor}
        open={sheet.name === "edit" && editor.barcode !== null}
        onClose={closeEdit}
        format={format}
        source="manual"
        onSaveNext={() => save("next")}
        onFinish={() => save("finish")}
      />
    </BarcodeKeypad>
  );
}
