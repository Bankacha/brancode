import { useRef } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { useLongPress } from "../lib/useLongPress.js";

// One list on the Popis/Trebovanje screens: tap opens it, long-press offers
// to delete it (the click that ends a long-press doesn't open it).
export default function ListCard({ to, title, meta, onLongPress }) {
  const longPressed = useRef(false);
  const press = useLongPress(() => {
    longPressed.current = true;
    onLongPress();
  });
  const onClick = (e) => {
    if (!longPressed.current) return;
    longPressed.current = false;
    e.preventDefault();
  };
  return (
    <li {...press} className="select-none [-webkit-touch-callout:none]">
      <Link
        to={to}
        onClick={onClick}
        className="flex items-center gap-3 rounded-field border-[1.5px] border-border-soft bg-surface py-3 pr-3 pl-4 transition-transform duration-100 active:scale-[.98]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold text-ink">{title}</span>
          <span className="block text-[13px] text-ink-3">{meta}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-ink-4" />
      </Link>
    </li>
  );
}
