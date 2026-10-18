import { useParams } from "react-router";
import { popisKind } from "../lib/listKinds.js";
import CameraScanner from "../components/CameraScanner.jsx";
import ListItemSheet from "../sheets/ListItemSheet.jsx";
import { useListEntry } from "./useListEntry.js";

// /popis/:id/skeniranje — counting with the camera: a read pauses it and
// opens the item sheet; saving resumes for the next article.
export default function InventoryScan() {
  const { id } = useParams();
  const entry = useListEntry(id, popisKind);
  return (
    <CameraScanner paused={entry.sheet.name === "item"} onRead={entry.begin} home={entry.home} manualPath={`/popis/${id}/rucni-unos`}>
      <ListItemSheet flow={entry.flow} texts={popisKind.texts} open={entry.open} onClose={entry.close} source="scan" onSubmit={entry.submit} />
    </CameraScanner>
  );
}
