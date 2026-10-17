import { LogOut, Trash2 } from "lucide-react";
import BottomSheet from "../components/BottomSheet.jsx";
import Button from "../components/Button.jsx";

export default function MenuSheet({ open, onClose, email, canClear, onClear, onSignOut }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <p className="font-mono text-xs text-ink-3">{email}</p>
      <Button variant="outline" size="md" icon={Trash2} disabled={!canClear} onClick={onClear} className="w-full">
        Obriši listu
      </Button>
      <Button variant="text" size="md" icon={LogOut} onClick={onSignOut} className="w-full">
        Odjavi se
      </Button>
    </BottomSheet>
  );
}
