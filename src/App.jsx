import { Navigate, Route, Routes, useNavigate } from "react-router";
import { usePrintQueue } from "./lib/printQueue.js";
import { useProductEditor } from "./lib/useProductEditor.js";
import { ToastProvider } from "./components/Toast.jsx";
import LegacyLayout from "./screens/LegacyLayout.jsx";
import Home from "./screens/Home.jsx";
import Scan from "./screens/Scan.jsx";
import ManualEntry from "./screens/ManualEntry.jsx";

export default function App({ session }) {
  const navigate = useNavigate();
  const [queue, setQueue] = usePrintQueue();
  const editor = useProductEditor(queue, setQueue);

  // Replace the camera / manual-entry entry so system back doesn't return to it.
  const openCode = (code) => {
    navigate("/", { replace: true });
    editor.open(code);
  };

  const legacy = (element) => <LegacyLayout queueLength={queue.length}>{element}</LegacyLayout>;

  return (
    <ToastProvider>
      <div className="mx-auto min-h-dvh w-full max-w-[480px]">
        <Routes>
          <Route path="/" element={<Home queue={queue} setQueue={setQueue} editor={editor} session={session} />} />
          <Route path="/skeniranje" element={legacy(<Scan onDetected={openCode} />)} />
          <Route path="/rucni-unos" element={legacy(<ManualEntry onSubmit={openCode} />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ToastProvider>
  );
}
