import { useEffect, useRef } from "react";
import Button from "./Button.jsx";

// A small yes/no window (opened with useDialog, so back closes it), like
// "Broj kopija". While `busy` both buttons are locked, and a double tap on
// the confirm button runs onConfirm only once.
function Panel({ title, text, confirmLabel, cancelLabel, busy, onConfirm, onClose }) {
  const fired = useRef(false);
  useEffect(() => {
    if (!busy) fired.current = false;
  }, [busy]);

  // Captured on window before a sheet's own Escape handler, so Escape closes
  // only this window.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (!busy) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy, onClose]);

  const confirm = () => {
    if (busy || fired.current) return;
    fired.current = true;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-8">
      <button type="button" aria-label="Zatvori" className="absolute inset-0 cursor-default bg-scrim/80" onClick={busy ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="relative flex w-full max-w-[340px] flex-col gap-4 rounded-card bg-bg p-5">
        <h2 id="confirm-title" className="text-center font-display text-[22px] font-extrabold text-ink wrap-break-word">
          {title}
        </h2>
        {text && <p className="text-center text-[15px] text-ink-2 wrap-break-word">{text}</p>}
        <div className="flex flex-col gap-2">
          <Button variant="accent" autoFocus disabled={busy} onClick={confirm} className="w-full">
            {confirmLabel}
          </Button>
          <Button variant="text" size="md" disabled={busy} onClick={onClose} className="w-full">
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Mounted fresh on every opening.
export default function ConfirmDialog({ open, cancelLabel = "Odustani", ...props }) {
  return open ? <Panel cancelLabel={cancelLabel} {...props} /> : null;
}
