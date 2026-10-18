import { trebovanjeKind } from "../lib/listKinds.js";
import ListScan from "./ListScan.jsx";

// /trebovanje/:id/skeniranje
export default function RequisitionScan() {
  return <ListScan kind={trebovanjeKind} />;
}
