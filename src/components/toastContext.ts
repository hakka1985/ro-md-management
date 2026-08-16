import { createContext, useContext } from "react";

export interface ToastContextValue {
  /** Shows a dismissible toast with an "元に戻す" button for a few seconds — the shared undo pattern for every delete action in the app. */
  showUndo: (message: string, onUndo: () => void) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
