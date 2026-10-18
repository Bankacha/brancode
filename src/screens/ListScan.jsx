import { useParams } from "react-router";
import CameraScanner from "../components/CameraScanner.jsx";
import ListItemSheet from "../sheets/ListItemSheet.jsx";
import { useListEntry } from "./useListEntry.js";

// /popis/:id/skeniranje and /trebovanje/:id/skeniranje — the camera for a
// list (`kind` from listKinds.js): a read pauses it and opens the item
// sheet; saving resumes for the next article.
export default function ListScan({ kind }) {
  const { id } = useParams();
  const entry = useListEntry(id, kind);
  return (
    <CameraScanner paused={entry.sheet.name === "item"} onRead={entry.begin} home={entry.home} manualPath={`/${kind.section}/${id}/rucni-unos`}>
      <ListItemSheet flow={entry.flow} texts={kind.texts} open={entry.open} onClose={entry.close} source="scan" onSubmit={entry.submit} />
    </CameraScanner>
  );
}
