import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { leaveScreen } from "../lib/navigation.js";
import BarcodeKeypad from "../components/BarcodeKeypad.jsx";
import ListItemSheet from "../sheets/ListItemSheet.jsx";
import { useListEntry } from "./useListEntry.js";

// /popis/:id/rucni-unos and /trebovanje/:id/rucni-unos — typing codes into
// a list, one after another. A trebovanje can also take an item that is just
// a name ("Bez barkoda").
export default function ListManualEntry({ kind, withoutBarcode = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState("");
  const entry = useListEntry(id, kind, { onNext: () => setCode("") });

  const submit = () => {
    if (code) entry.begin(code);
  };

  return (
    <BarcodeKeypad
      code={code}
      onCodeChange={setCode}
      onSubmit={submit}
      onBack={() => leaveScreen(navigate, location, entry.home)}
      listening={!entry.sheet.name}
      extraAction={withoutBarcode ? { label: "Bez barkoda", run: entry.beginWithoutBarcode } : null}
    >
      <ListItemSheet flow={entry.flow} texts={kind.texts} open={entry.open} onClose={entry.close} source="manual" onSubmit={entry.submit} />
    </BarcodeKeypad>
  );
}
