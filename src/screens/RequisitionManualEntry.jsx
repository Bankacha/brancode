import { trebovanjeKind } from "../lib/listKinds.js";
import ListManualEntry from "./ListManualEntry.jsx";

// /trebovanje/:id/rucni-unos
export default function RequisitionManualEntry() {
  return <ListManualEntry kind={trebovanjeKind} withoutBarcode />;
}
