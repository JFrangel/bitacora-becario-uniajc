import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const SHOW_MS = 3400;

type ToastFn = (message: string) => void;
const ToastContext = createContext<ToastFn>(() => {});

/** Avisos temporales desde abajo, anunciados a lectores de pantalla (`role="status"`). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback<ToastFn>((text) => {
    setMessage(text);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), SHOW_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => notify, [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={`toast${show ? ' show' : ''}`} role="status" aria-live="polite">
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
