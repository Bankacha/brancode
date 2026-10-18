import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Check, WifiOff } from "lucide-react";
import { formatPrice } from "../lib/format.js";
import { finishScreen, putHomeBehind } from "../lib/navigation.js";
import { usePrintFormat } from "../lib/printFormat.js";
import { useSheet } from "../lib/useSheet.js";
import { useToast } from "../components/Toast.jsx";
import CameraScanner from "../components/CameraScanner.jsx";
import EditSheet from "../sheets/EditSheet.jsx";

// Handoff "03 · Skeniranje" for price tags: scanning in a row. A confirmed
// read pauses the camera and opens the edit sheet over it; closing the sheet
// in any way resumes scanning.
export default function Scan({ editor }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sheet = useSheet();
  const toast = useToast();
  const [format] = usePrintFormat();
  const [sessionCount, setSessionCount] = useState(0);
  const paused = sheet.name === "edit";

  // Opened as the first page: put home behind this screen (once — StrictMode
  // runs effects twice).
  const homeBehind = useRef(false);
  useEffect(() => {
    if (homeBehind.current) return;
    homeBehind.current = true;
    putHomeBehind(navigate, location);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A refreshed page can't have a read in flight: drop a stale "edit" entry.
  useEffect(() => {
    if (sheet.name === "edit" && editor.barcode === null) navigate(".", { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRead = (code) => {
    setSessionCount((n) => n + 1);
    editor.open(code);
    sheet.open("edit");
  };

  const added = (item) => toast.show({ kind: "success", icon: Check, text: `Dodato: ${item.name}`, detail: formatPrice(item.price) });

  const save = async (then) => {
    const saved = await editor.save();
    if (!saved) {
      toast.show({ kind: "error", icon: WifiOff, text: "Nema veze. Nije sačuvano.", action: { label: "Ponovi", run: () => saveRef.current(then) } });
      return;
    }
    added(saved);
    if (then === "next") sheet.close();
    else finishScreen(navigate, sheet.isOpen());
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  const skip = () => {
    const item = editor.skip();
    if (!item) return;
    added(item);
    sheet.close();
  };

  const cancel = () => {
    sheet.close();
    editor.close();
  };

  return (
    <CameraScanner paused={paused} onRead={onRead}>
      <EditSheet
        editor={editor}
        open={paused && editor.barcode !== null}
        onClose={cancel}
        format={format}
        source="scan"
        sessionCount={sessionCount}
        onSaveNext={() => save("next")}
        onSkip={skip}
        onFinish={() => save("finish")}
      />
    </CameraScanner>
  );
}
