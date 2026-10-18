import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { shouldDismissDrag } from "../lib/gestures.js";
import { useVisibleViewport } from "../lib/useVisibleViewport.js";

const ANIMATION_MS = 250;
const INTERACTIVE = "input, textarea, select, button, a, label";

// Counted, because switching sheets briefly mounts two at once.
let scrollLocks = 0;
const lockScroll = () => {
  if (scrollLocks++ === 0) document.body.style.overflow = "hidden";
};
const unlockScroll = () => {
  if (--scrollLocks === 0) document.body.style.overflow = "";
};

// Slides up from the bottom over a scrim. Closes on scrim tap, a drag down,
// Escape — and system back, via useSheet. `dismissible={false}` while work
// is in flight; `closeOnScrim={false}` where a stray tap on what's behind
// (the camera) shouldn't count as cancelling; `dim={false}` keeps what's
// behind fully visible (the paused camera frame).
export default function BottomSheet({ open, onClose, dismissible = true, closeOnScrim = true, dim = true, children }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const drag = useRef(null);
  // Stays above the on-screen keyboard and within what it leaves visible, so
  // the save buttons can be reached without closing the keyboard first.
  const visible = useVisibleViewport();
  // A sheet taller than that scrolls by touch (closing it is then by back or
  // a tap outside); otherwise touch drags belong to drag-to-close.
  const panel = useRef(null);
  const [scrollable, setScrollable] = useState(false);
  useLayoutEffect(() => {
    const el = panel.current;
    const next = Boolean(el) && el.scrollHeight > el.clientHeight + 1;
    if (next !== scrollable) setScrollable(next);
  });

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // While a sheet is up the page behind must not scroll: on touch screens a
  // downward drag would otherwise become a scroll and cancel the gesture.
  useEffect(() => {
    if (!mounted) return;
    lockScroll();
    return unlockScroll;
  }, [mounted]);

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  if (!mounted) return null;

  const onPointerDown = (e) => {
    if (!dismissible || scrollable || e.target.closest(INTERACTIVE)) return;
    drag.current = { y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (drag.current) setDragY(Math.max(0, e.clientY - drag.current.y));
  };
  const onPointerEnd = (e) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    const ms = performance.now() - drag.current.t;
    drag.current = null;
    setDragY(0);
    if (shouldDismissDrag(dy, ms)) onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 transition-opacity duration-250 ${dim ? "bg-scrim/80" : ""} ${shown ? "opacity-100" : "opacity-0"}`}
        onClick={dismissible && closeOnScrim ? onClose : undefined}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-full max-w-[480px]" style={visible.keyboard ? { bottom: visible.keyboard } : undefined}>
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{
            ...(visible.height ? { maxHeight: visible.height - 8 } : {}),
            ...(dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : {}),
          }}
          className={`pointer-events-auto flex ${scrollable ? "touch-pan-y" : "touch-none"} flex-col gap-3.5 overflow-y-auto rounded-t-sheet bg-bg px-5 pt-3 pb-[calc(34px+env(safe-area-inset-bottom))] transition-transform duration-250 ease-out ${shown ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="mx-auto mb-1 h-[5px] w-10 shrink-0 rounded-full bg-border" />
          {children}
        </div>
      </div>
    </div>
  );
}
