import React from 'react';
import { useUIStore } from '../../store/ui.store';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 w-full max-w-[360px] px-4 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={`pointer-events-auto flex items-center justify-between px-3.5 py-2.5 rounded-xl shadow-xl text-xs font-semibold tracking-wide border transition-all animate-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-[#0D2D1E] text-[#00E676] border-[#00B85F]/50 shadow-[0_0_15px_rgba(0,184,95,0.2)]'
              : toast.type === 'error'
              ? 'bg-[#2D1212] text-[#FF5A36] border-[#FF5A36]/50'
              : 'bg-[#1A1B1E] text-white border-[#303338]'
          }`}
        >
          <span>{toast.message}</span>
          <button className="ml-2 text-white/60 hover:text-white text-sm">✕</button>
        </div>
      ))}
    </div>
  );
};
