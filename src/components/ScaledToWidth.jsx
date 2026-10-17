import { useLayoutEffect, useRef, useState } from "react";

const PX_PER_MM = 96 / 25.4;

// Draws children at their real size (in mm) and scales them down to the
// available width. The layout keeps the scaled height of what was actually
// drawn (cell borders add a pixel or two to the nominal size), falling back
// to `heightMm` before the first measurement.
export default function ScaledToWidth({ widthMm, heightMm, children }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [scale, setScale] = useState(1);
  const [naturalHeightPx, setNaturalHeightPx] = useState(heightMm * PX_PER_MM);
  const naturalWidthPx = widthMm * PX_PER_MM;

  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const update = () => {
      if (outer.current?.clientWidth > 0) setScale(outer.current.clientWidth / naturalWidthPx);
      if (inner.current?.offsetHeight > 0) setNaturalHeightPx(inner.current.offsetHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer.current);
    observer.observe(inner.current);
    return () => observer.disconnect();
  }, [naturalWidthPx]);

  return (
    <div ref={outer} className="w-full overflow-hidden" style={{ height: `${naturalHeightPx * scale}px` }}>
      <div ref={inner} style={{ width: `${widthMm}mm`, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
