import { useEffect, useRef } from "react";

const MOVE_TOLERANCE_PX = 10;

// Handlers for a press-and-hold of `ms`. A tap, a scroll (pointercancel or
// moving the finger) or a press that starts on a button inside never fires.
export const useLongPress = (onLongPress, { ms = 500 } = {}) => {
  const timer = useRef(null);
  const start = useRef(null);

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  useEffect(() => cancel, []);

  return {
    onPointerDown: (e) => {
      cancel();
      if (e.target.closest?.("button")) return;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        navigator.vibrate?.(10);
        onLongPress();
      }, ms);
    },
    onPointerMove: (e) => {
      if (!start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e) => e.preventDefault(),
  };
};
