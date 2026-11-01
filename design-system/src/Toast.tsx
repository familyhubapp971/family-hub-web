import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULTS: Record<ToastType, number> = { success: 4000, error: 6000, info: 4000 };
// Neo-brutalist toast look: a black border + hard drop-shadow (no blur) on
// every toast, same visual language as Card/ConfirmDialog. Colour only
// varies the fill + icon so success/error/info stay distinguishable.
const STYLES: Record<ToastType, string> = {
  success: 'bg-lime-50 text-green-900',
  error: 'bg-red-50 text-red-900',
  info: 'bg-cyan-50 text-blue-900',
};
const ICON_STYLES: Record<ToastType, string> = {
  success: 'text-green-600',
  error: 'text-red-600',
  info: 'text-blue-600',
};
const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

// nextId is per-provider via useRef below: module-level state would
// collide under HMR, multiple providers, or test isolation.

function ToastMessage({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const Icon = ICONS[item.type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(item.id), 300);
    }, item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      className={`
        flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-black shadow-neo-sm
        font-body font-bold text-sm transition-all duration-300 max-w-md w-full
        ${STYLES[item.type]}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${ICON_STYLES[item.type]}`} />
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(item.id), 300);
        }}
        aria-label="Dismiss"
        className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center opacity-60 hover:opacity-100"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    nextIdRef.current += 1;
    const id = nextIdRef.current;
    const item: ToastItem = { id, message, type, duration: duration ?? DEFAULTS[type] };
    setToasts((prev) => [...prev.slice(-2), item]); // max 3
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastMessage item={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
