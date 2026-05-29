import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useUIStore } from '../store';
import { ChevronLeft, Lock } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const role = user?.role;
  const { activeMode, setMode } = useUIStore();

  return (
    <div className="min-h-screen bg-school-paper flex flex-col selection:bg-school-accent selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-school-primary text-school-paper shadow-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activeMode && (
            <button
              onClick={() => setMode(null)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="font-serif text-xl leading-tight">AL RAWA</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-70">English School</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-[10px] font-bold uppercase tracking-tighter opacity-50">Logged in as</span>
            <span className="text-xs font-semibold">{role === 'admin' ? '👑 Admin' : '👁️ Viewer'}</span>
          </div>
          <button
            onClick={logout}
            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
            title="Lock App"
          >
            <Lock size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMode || 'home'}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-4 md:p-6 max-w-7xl mx-auto w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-school-secondary text-white/50 text-[10px] py-2 px-4 flex justify-between items-center border-t border-white/5">
        <span>© 2026 AL RAWA English School</span>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          <span className="uppercase tracking-widest text-[9px]">Connected</span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
