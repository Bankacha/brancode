import { Download, Send } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";
import { itemCount } from "../lib/listFormat.js";

// PDF of a Popis or Trebovanje: save it on the phone or mail it to the shop.
export default function ExportSheet({ open, onClose, count, busy, onDownload, onEmail }) {
  return (
    <BottomSheet open={open} onClose={onClose} dismissible={!busy}>
      <h2 className="font-display text-[26px] font-extrabold text-ink">PDF</h2>
      <p className="text-[15px] text-ink-2">Sve stavke ({itemCount(count)}), sa zaglavljem i brojem strane, spremno za štampu.</p>
      <Button icon={Send} onClick={onEmail} disabled={busy} className="mt-1 w-full">
        Pošalji mejlom
      </Button>
      <Button variant="dark" size="md" icon={Download} onClick={onDownload} disabled={busy} className="w-full">
        Preuzmi PDF
      </Button>
    </BottomSheet>
  );
}
