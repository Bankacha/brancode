import { Navigate, Route, Routes } from "react-router";
import { usePrintQueue } from "./lib/printQueue.js";
import { useProductEditor } from "./lib/useProductEditor.js";
import { ToastProvider } from "./components/Toast.jsx";
import { SessionProvider } from "./auth/session.jsx";
import Home from "./screens/Home.jsx";
import Scan from "./screens/Scan.jsx";
import ManualEntry from "./screens/ManualEntry.jsx";
import PrintPreview from "./screens/PrintPreview.jsx";
import InventoryLists from "./screens/InventoryLists.jsx";
import Inventory from "./screens/Inventory.jsx";
import InventoryScan from "./screens/InventoryScan.jsx";
import InventoryManualEntry from "./screens/InventoryManualEntry.jsx";
import RequisitionLists from "./screens/RequisitionLists.jsx";
import Requisition from "./screens/Requisition.jsx";
import RequisitionScan from "./screens/RequisitionScan.jsx";
import RequisitionManualEntry from "./screens/RequisitionManualEntry.jsx";

export default function App({ session }) {
  const [queue, setQueue] = usePrintQueue();
  const editor = useProductEditor(queue, setQueue);

  return (
    <SessionProvider value={session}>
      <ToastProvider>
        <div className="mx-auto min-h-dvh w-full max-w-[480px]">
          <Routes>
            <Route path="/" element={<Home queue={queue} setQueue={setQueue} editor={editor} />} />
            <Route path="/pregled" element={<PrintPreview queue={queue} setQueue={setQueue} />} />
            <Route path="/skeniranje" element={<Scan editor={editor} />} />
            <Route path="/rucni-unos" element={<ManualEntry editor={editor} />} />
            <Route path="/popis" element={<InventoryLists />} />
            <Route path="/popis/:id" element={<Inventory />} />
            <Route path="/popis/:id/skeniranje" element={<InventoryScan />} />
            <Route path="/popis/:id/rucni-unos" element={<InventoryManualEntry />} />
            <Route path="/trebovanje" element={<RequisitionLists />} />
            <Route path="/trebovanje/:id" element={<Requisition />} />
            <Route path="/trebovanje/:id/skeniranje" element={<RequisitionScan />} />
            <Route path="/trebovanje/:id/rucni-unos" element={<RequisitionManualEntry />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
