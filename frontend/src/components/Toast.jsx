/*
 * Reusable toast notifications. <ToastProvider> sits once at the top of the app (so a toast
 * survives a page change); any component calls `const toast = useToast()` and then
 * toast.success(msg), toast.error(msg), toast.warning(msg) or toast.info(msg).
 * Success and info dismiss themselves after 5 s, warning after 9 s, errors after 8 s; every toast
 * can be closed by hand. Errors are announced assertively (role=alert), the rest politely.
 * Styling lives in styles/app.css (.toasts / .toast).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/app.css';

const DURATIONS = { success: 5000, info: 5000, warning: 9000, error: 8000 };
const MAX_VISIBLE = 4;

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((kind, message, duration) => {
    if (!message) return null;
    const id = nextId.current++;
    setToasts((list) => [...list, { id, kind, message }].slice(-MAX_VISIBLE));
    timers.current.set(id, setTimeout(() => dismiss(id), duration ?? DURATIONS[kind]));
    return id;
  }, [dismiss]);

  useEffect(() => {
    const active = timers.current;
    return () => { active.forEach((t) => clearTimeout(t)); active.clear(); };
  }, []);

  const api = useMemo(() => ({
    show,
    dismiss,
    success: (message, duration) => show('success', message, duration),
    error: (message, duration) => show('error', message, duration),
    warning: (message, duration) => show('warning', message, duration),
    info: (message, duration) => show('info', message, duration),
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}
               role={t.kind === 'error' ? 'alert' : 'status'}>
            <span className="toast__text">{t.message}</span>
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)}
                    aria-label="Dismiss notification">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const NOOP = Object.freeze({
  show: () => null, dismiss: () => {}, success: () => null, error: () => null,
  warning: () => null, info: () => null,
});

/** Outside a provider (e.g. an isolated component test) the calls do nothing instead of crashing. */
export function useToast() {
  return useContext(ToastContext) ?? NOOP;
}
