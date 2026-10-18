import { popisKind } from "../lib/listKinds.js";
import ListScan from "./ListScan.jsx";

// /popis/:id/skeniranje
export default function InventoryScan() {
  return <ListScan kind={popisKind} />;
}
