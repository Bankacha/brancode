import { useLayoutEffect, useRef, useState } from "react";

const PX_PER_MM = 96 / 25.4;

// Draws children at their real size (in mm) and scales them down to the
// available width, keeping the scaled height in the layout.
export default function ScaledToWidth({ widthMm, heightMm, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  const naturalWidthPx = widthMm * PX_PER_MM;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      if (el.clientWidth > 0) setScale(el.clientWidth / naturalWidthPx);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [naturalWidthPx]);

  return (
    <div ref={ref} className="w-full overflow-hidden" style={{ height: `${heightMm * PX_PER_MM * scale}px` }}>
      <div style={{ width: `${widthMm}mm`, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}
