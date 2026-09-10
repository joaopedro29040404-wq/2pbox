'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
};

type Toast = Required<Omit<ToastInput, 'description'>> & { id: number; description?: string };

type ToastApi = {
  toast: (input: ToastInput) => number;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  warning: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info } as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sequence = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({ title, description, tone = 'info', duration = 4200 }: ToastInput) => {
      const id = ++sequence.current;
      setToasts((current) => [...current.slice(-3), { id, title, description, tone, duration }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const registry = timers.current;
    return () => {
      registry.forEach(clearTimeout);
      registry.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error', duration: 6000 }),
      info: (title, description) => toast({ title, description, tone: 'info' }),
      warning: (title, description) => toast({ title, description, tone: 'warning', duration: 5200 }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" role="region" aria-live="polite" aria-label="Notificações">
        {toasts.map((item) => {
          const Icon = ICONS[item.tone];
          return (
            <div className={`toast toast-${item.tone}`} key={item.id} role="status">
              <span className="toast-icon">
                <Icon size={17} />
              </span>
              <div className="toast-copy">
                <strong>{item.title}</strong>
                {item.description && <span>{item.description}</span>}
              </div>
              <button type="button" onClick={() => dismiss(item.id)} aria-label="Fechar notificação">
                <X size={15} />
              </button>
              <i className="toast-bar" style={{ animationDuration: `${item.duration}ms` }} />
            </div>
          );
        })}
      </div>
      <style jsx global>{`
        .toast-viewport{position:fixed;z-index:9999;right:20px;bottom:20px;display:grid;gap:10px;width:min(360px,calc(100vw - 32px));pointer-events:none}
        .toast{position:relative;display:flex;align-items:flex-start;gap:11px;padding:14px 14px 15px;background:#fff;border:1px solid #e2e2dd;border-left:4px solid #111;border-radius:12px;box-shadow:0 14px 38px rgba(0,0,0,.14);pointer-events:auto;overflow:hidden;animation:toast-in .22s cubic-bezier(.2,.9,.3,1)}
        .toast-icon{flex:none;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#f3f3ef;color:#111}
        .toast-copy{flex:1;min-width:0;display:grid;gap:3px}
        .toast-copy strong{font:800 12.5px/1.35 Inter,Arial,sans-serif;color:#111}
        .toast-copy span{font:400 11.5px/1.5 Inter,Arial,sans-serif;color:#6d6d6d;overflow-wrap:anywhere}
        .toast>button{flex:none;width:26px;height:26px;border:0;border-radius:7px;background:transparent;color:#9a9a9a;display:grid;place-items:center;cursor:pointer}
        .toast>button:hover{background:#f2f2ee;color:#111}
        .toast-bar{position:absolute;left:0;bottom:0;height:2px;width:100%;background:#111;opacity:.18;transform-origin:left;animation:toast-bar linear forwards}
        .toast-success{border-left-color:#2e9954}.toast-success .toast-icon{background:#e9f7ee;color:#227941}.toast-success .toast-bar{background:#2e9954}
        .toast-error{border-left-color:#c62828}.toast-error .toast-icon{background:#fdecec;color:#c62828}.toast-error .toast-bar{background:#c62828}
        .toast-warning{border-left-color:#ffc400}.toast-warning .toast-icon{background:#fff7d6;color:#9a7200}.toast-warning .toast-bar{background:#e0ac00}
        .toast-info{border-left-color:#111}.toast-info .toast-icon{background:#f3f3ef;color:#111}
        @keyframes toast-in{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes toast-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}
        @media(max-width:600px){.toast-viewport{right:12px;left:12px;bottom:12px;width:auto}.toast{padding:12px}.toast-copy strong{font-size:12px}.toast-copy span{font-size:11px}}
        @media(prefers-reduced-motion:reduce){.toast{animation:none}.toast-bar{animation:none}}
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de ToastProvider');
  return context;
}
