import { useParams } from "react-router";
import CameraScanner from "../components/CameraScanner.jsx";
import InventoryItemSheet from "../sheets/InventoryItemSheet.jsx";
import { useInventoryEntry } from "./useInventoryEntry.js";

// /popis/:id/skeniranje — counting with the camera: a read pauses it and
// opens the item sheet; saving resumes for the next article.
export default function InventoryScan() {
  const { id } = useParams();
  const entry = useInventoryEntry(id);
  return (
    <CameraScanner paused={entry.sheet.name === "item"} onRead={entry.begin} home={entry.home} manualPath={`/popis/${id}/rucni-unos`}>
      <InventoryItemSheet flow={entry.flow} open={entry.open} onClose={entry.close} source="scan" onSubmit={entry.submit} />
    </CameraScanner>
  );
}
