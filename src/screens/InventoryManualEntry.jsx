import { popisKind } from "../lib/listKinds.js";
import ListManualEntry from "./ListManualEntry.jsx";

// /popis/:id/rucni-unos
export default function InventoryManualEntry() {
  return <ListManualEntry kind={popisKind} />;
}
