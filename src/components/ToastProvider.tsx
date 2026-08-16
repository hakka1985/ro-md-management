import { useRef, useState, type ReactNode } from "react";
import { ToastContext } from "./toastContext";

interface ToastEntry {
  id: string;
  message: string;
  onUndo: () => void;
}

const UNDO_TIMEOUT_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function dismiss(id: string) {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function showUndo(message: string, onUndo: () => void) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, onUndo }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, UNDO_TIMEOUT_MS);
    timers.current.set(id, timer);
  }

  function handleUndo(toast: ToastEntry) {
    toast.onUndo();
    dismiss(toast.id);
  }

  return (
    <ToastContext.Provider value={{ showUndo }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.message}</span>
            <button
              type="button"
              className="toast-undo-btn"
              onClick={() => handleUndo(t)}
            >
              元に戻す
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
