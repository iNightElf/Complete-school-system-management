import React, { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info' | '';
  visible: boolean;
}

let toastFn: ((msg: string, type?: 'success' | 'error' | 'info' | '') => void) | null = null;

export const toast = (msg: string, type: 'success' | 'error' | 'info' | '' = '') => {
  toastFn?.(msg, type);
};

const Toast: React.FC = () => {
  const [state, setState] = useState<ToastState>({ message: '', type: '', visible: false });

  const hide = useCallback(() => setState((s) => ({ ...s, visible: false })), []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    toastFn = (message, type = '') => {
      setState({ message, type, visible: true });
      clearTimeout(timer);
      const duration = type === 'error' ? 6000 : 3000;
      timer = setTimeout(hide, duration);
    };
    return () => { clearTimeout(timer); toastFn = null; };
  }, [hide]);

  if (!state.visible) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 flex items-center gap-3 max-w-xs ${
        state.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${
        state.type === 'success' ? 'bg-green-600 text-white' :
        state.type === 'error' ? 'bg-red-500 text-white' :
        state.type === 'info' ? 'bg-blue-600 text-white' :
        'bg-school-primary text-white'
      }`}
    >
      <span className="flex-1">{state.message}</span>
      <button onClick={hide} className="p-0.5 rounded-full hover:bg-white/20 transition-colors flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;
