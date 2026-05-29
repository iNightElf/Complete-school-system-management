import React, { useEffect, useState } from 'react';

interface ToastState {
  message: string;
  type: 'success' | 'error' | '';
  visible: boolean;
}

let toastFn: ((msg: string, type?: 'success' | 'error') => void) | null = null;

export const toast = (msg: string, type: 'success' | 'error' = '') => {
  toastFn?.(msg, type);
};

const Toast: React.FC = () => {
  const [state, setState] = useState<ToastState>({ message: '', type: '', visible: false });

  useEffect(() => {
    toastFn = (message, type = '') => {
      setState({ message, type, visible: true });
      setTimeout(() => setState((s) => ({ ...s, visible: false })), 3000);
    };
    return () => { toastFn = null; };
  }, []);

  if (!state.visible) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 ${
        state.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${
        state.type === 'success' ? 'bg-green-600 text-white' :
        state.type === 'error' ? 'bg-red-500 text-white' :
        'bg-school-primary text-white'
      }`}
    >
      {state.message}
    </div>
  );
};

export default Toast;
