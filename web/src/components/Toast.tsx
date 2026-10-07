"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface ToastMessage {
  id: number;
  text: ReactNode;
  kind: "info" | "error";
}

interface ToastApi {
  show: (text: ReactNode) => void;
  error: (text: ReactNode) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const HIDE_AFTER_MS = 4500;

/** Single bottom-right toast that auto-hides after 4.5s (§4), announced politely (§9). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const push = useCallback((text: ReactNode, kind: ToastMessage["kind"]) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: ++seq.current, text, kind });
    timer.current = setTimeout(() => setToast(null), kind === "error" ? HIDE_AFTER_MS * 1.5 : HIDE_AFTER_MS);
  }, []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const api = useMemo<ToastApi>(() => ({ show: (t) => push(t, "info"), error: (t) => push(t, "error") }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true">
        {toast && (
          <div key={toast.id} className={`toast${toast.kind === "error" ? " error" : ""}`}>
            {toast.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
