import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { leaveScreen } from "../lib/navigation.js";
import { popisKind } from "../lib/listKinds.js";
import BarcodeKeypad from "../components/BarcodeKeypad.jsx";
import ListItemSheet from "../sheets/ListItemSheet.jsx";
import { useListEntry } from "./useListEntry.js";

// /popis/:id/rucni-unos — typing codes into a popis, one after another.
export default function InventoryManualEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState("");
  const entry = useListEntry(id, popisKind, { onNext: () => setCode("") });

  const submit = () => {
    if (code) entry.begin(code);
  };

  return (
    <BarcodeKeypad code={code} onCodeChange={setCode} onSubmit={submit} onBack={() => leaveScreen(navigate, location, entry.home)} listening={!entry.sheet.name}>
      <ListItemSheet flow={entry.flow} texts={popisKind.texts} open={entry.open} onClose={entry.close} source="manual" onSubmit={entry.submit} />
    </BarcodeKeypad>
  );
}
