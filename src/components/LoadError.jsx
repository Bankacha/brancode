import { WifiOff } from "lucide-react";
import Button from "./Button.jsx";

// A screen whose data couldn't be loaded (usually no connection).
export default function LoadError({ text, onRetry }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-card bg-surface-muted px-5 py-6 text-center">
      <WifiOff size={24} className="text-ink-3" />
      <p className="text-[15px] text-ink-2">{text}</p>
      <Button variant="dark" size="md" onClick={onRetry}>
        Pokušaj ponovo
      </Button>
    </div>
  );
}

