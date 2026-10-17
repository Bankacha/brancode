import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { openSheetOverHome } from "./lib/navigation.js";
import { usePrintQueue } from "./lib/printQueue.js";
import { useProductEditor } from "./lib/useProductEditor.js";
import { ToastProvider } from "./components/Toast.jsx";
import LegacyLayout from "./screens/LegacyLayout.jsx";
import Home from "./screens/Home.jsx";
import Scan from "./screens/Scan.jsx";
import ManualEntry from "./screens/ManualEntry.jsx";
import PrintPreview from "./screens/PrintPreview.jsx";

export default function App({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [queue, setQueue] = usePrintQueue();
  const editor = useProductEditor(queue, setQueue);

  // Back closes the edit sheet and never reopens the camera / manual entry.
  const openCode = (code) => {
    editor.open(code);
    openSheetOverHome(navigate, location, "edit");
  };

  const legacy = (element) => <LegacyLayout queueLength={queue.length}>{element}</LegacyLayout>;

  return (
    <ToastProvider>
      <div className="mx-auto min-h-dvh w-full max-w-[480px]">
        <Routes>
          <Route path="/" element={<Home queue={queue} setQueue={setQueue} editor={editor} session={session} />} />
          <Route path="/pregled" element={<PrintPreview queue={queue} />} />
          <Route path="/skeniranje" element={legacy(<Scan onDetected={openCode} />)} />
          <Route path="/rucni-unos" element={<ManualEntry editor={editor} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ToastProvider>
  );
}
