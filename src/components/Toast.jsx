import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, Loader } from "lucide-react";

// One status at a time, shown above the bottom bar (handoff "09 · Statusi").
// toast = { kind: "success" | "error" | "loading" | "info", text, detail?, icon?, action?: { label, run }, duration? }
// Success hides after 2.5 s unless `duration` says otherwise; the rest stay
// until replaced, acted on or tapped away.
const ToastContext = createContext(null);

const SUCCESS_MS = 2500;

const styles = {
  success: { box: "bg-surface text-ink shadow-toast", circle: "bg-success text-white", Icon: Check },
  info: { box: "bg-surface text-ink shadow-toast", circle: "bg-surface-muted text-ink", Icon: Check },
  error: { box: "bg-danger-bg text-danger-ink", circle: "bg-accent text-white", Icon: CircleAlert },
  loading: { box: "bg-ink text-bg", circle: "bg-bg/10 text-bg", Icon: Loader },
};

function ToastView({ toast, onHide }) {
  const { box, circle, Icon: DefaultIcon } = styles[toast.kind];
  const Icon = toast.icon ?? DefaultIcon;
  const dismissOnTap = toast.kind === "error" || toast.kind === "info";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(150px+env(safe-area-inset-bottom))] z-[60] px-5">
      <div
        role="status"
        onClick={dismissOnTap ? onHide : undefined}
        className={`pointer-events-auto mx-auto flex w-full max-w-[440px] items-center gap-3 rounded-toast px-4 py-3 ${box}`}
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${circle}`}>
          <Icon size={18} className={toast.kind === "loading" ? "animate-spin" : undefined} />
        </span>
        {/* Errors and notes must stay readable; short success lines can clip. */}
        <span className={`min-w-0 flex-1 text-[15px] font-semibold ${dismissOnTap ? "line-clamp-3" : "truncate"}`}>{toast.text}</span>
        {toast.detail && <span className="shrink-0 font-mono text-[13px] opacity-80">{toast.detail}</span>}
        {toast.action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHide();
              toast.action.run();
            }}
            className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink transition-transform duration-100 active:scale-[.97]"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((next) => {
    clearTimeout(timer.current);
    const shown = { ...next };
    setToast(shown);
    const duration = next.duration ?? (next.kind === "success" ? SUCCESS_MS : null);
    if (duration) timer.current = setTimeout(() => setToast((current) => (current === shown ? null : current)), duration);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && <ToastView toast={toast} onHide={hide} />}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
