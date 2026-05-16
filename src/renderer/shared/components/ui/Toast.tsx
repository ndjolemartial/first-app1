import { create } from 'zustand';
import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { clsx } from 'clsx';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

interface ToastState {
  toasts: Toast[];
  add: (toast: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) =>
    set((s) => ({ toasts: [...s.toasts, { ...toast, id: crypto.randomUUID() }] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().add({ type: 'success', message }),
  error: (message: string) => useToastStore.getState().add({ type: 'error', message }),
  warning: (message: string) => useToastStore.getState().add({ type: 'warning', message }),
};

const icons = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertCircle className="h-5 w-5 text-amber-500" />,
};

function ToastItem({ toast: t }: { toast: Toast }) {
  const remove = useToastStore((s) => s.remove);
  useEffect(() => {
    const timer = setTimeout(() => remove(t.id), 4000);
    return () => clearTimeout(timer);
  }, [t.id, remove]);
  return (
    <div className={clsx('flex items-center gap-3 bg-white rounded-xl shadow-lg border px-4 py-3 min-w-[280px] max-w-sm',
      t.type === 'success' && 'border-green-200',
      t.type === 'error' && 'border-red-200',
      t.type === 'warning' && 'border-amber-200',
    )}>
      {icons[t.type]}
      <p className="flex-1 text-sm text-slate-700">{t.message}</p>
      <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-slate-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}
