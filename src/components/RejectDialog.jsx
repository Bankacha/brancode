import { useEffect, useId, useRef, useState } from "react";
import Button from "./Button.jsx";

const MAX = 500;

// "Odbiti fakturu?": SEF needs a reason, which goes to the supplier. A small
// window over the invoice sheet (useDialog), locked while the request runs.
function Panel({ busy, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const id = useId();
  const fired = useRef(false);
  useEffect(() => {
    if (!busy) fired.current = false;
  }, [busy]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (!busy) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy, onClose]);

  const ready = reason.trim().length > 0 && !busy;
  const confirm = () => {
    if (!ready || fired.current) return;
    fired.current = true;
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <button type="button" aria-label="Zatvori" className="absolute inset-0 cursor-default bg-scrim/80" onClick={busy ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="relative flex w-full max-w-[360px] flex-col gap-3 rounded-card bg-bg p-5">
        <h2 id={`${id}-title`} className="text-center font-display text-[22px] font-extrabold text-ink">
          Odbiti fakturu?
        </h2>
        <label htmlFor={id} className="text-xs font-semibold text-ink-3">
          Razlog odbijanja
        </label>
        <textarea
          id={id}
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX))}
          maxLength={MAX}
          rows={4}
          autoFocus
          className="w-full resize-none rounded-field border-[1.5px] border-border bg-surface px-3 py-2 text-[16px] text-ink outline-none focus:border-accent"
        />
        <p className="flex justify-between text-[12px] text-ink-3">
          <span>Razlog ide dobavljaču preko SEF-a.</span>
          <span className="font-mono">
            {reason.length}/{MAX}
          </span>
        </p>
        <Button variant="accent" disabled={!ready} onClick={confirm} className="w-full">
          Odbij
        </Button>
        <Button variant="text" size="md" disabled={busy} onClick={onClose} className="w-full">
          Odustani
        </Button>
      </div>
    </div>
  );
}

// Mounted fresh on every opening, so the reason starts empty.
export default function RejectDialog({ open, ...props }) {
  return open ? <Panel {...props} /> : null;
}
