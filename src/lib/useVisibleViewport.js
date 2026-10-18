import { useEffect, useState } from "react";

// The part of the screen the on-screen keyboard leaves visible. Android
// Chrome shrinks the page itself (interactive-widget=resizes-content in
// index.html), so `keyboard` stays 0 there; iPhone keeps the page and lays
// the keyboard over it, and `keyboard` is how far a bottom sheet must rise.
const read = () => {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv) return { keyboard: 0, height: null };
  return { keyboard: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)), height: Math.round(vv.height) };
};

export const useVisibleViewport = () => {
  const [state, setState] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setState(read());
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return state;
};
