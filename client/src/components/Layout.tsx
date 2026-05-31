import React, { useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useUIStore, useDarkMode } from '../store';
import { ChevronLeft, Lock, Users, Sun, Moon } from 'lucide-react';
import { SCHOOL_LOGO } from '../lib/logo';
import BottomNav from './BottomNav';

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  accountant: 'Accountant',
  viewer: 'Viewer',
};

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { logout, user } = useAuthStore();
  const role = user?.role;
  const { activeMode, swipeBack } = useUIStore();
  const { dark, toggle: toggleDark } = useDarkMode();

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleBack = useCallback(() => {
    swipeBack();
    // If swipeBack went to null mode, clear URL param
    const { activeMode: currentMode } = useUIStore.getState();
    if (!currentMode) {
      setSearchParams({}, { replace: true });
    }
  }, [swipeBack, setSearchParams]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx > 80 && activeMode) {
      handleBack();
    }
  }, [activeMode, handleBack]);

  return (
    <div className="min-h-screen bg-school-paper flex flex-col selection:bg-school-accent selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-school-primary text-school-paper shadow-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activeMode && (
            <button
              onClick={handleBack}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <img src={SCHOOL_LOGO} alt="Logo" className="w-9 h-9 rounded-full object-cover ring-2 ring-white/20 shadow-sm" id="school-logo" />
          <div>
            <h1 className="font-serif text-xl leading-tight">AL RAWA</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-70">English School</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {role === 'admin' && (
            <button
              onClick={() => navigate('/users')}
              className="p-2 hover:bg-white/10 rounded-full transition-colors group"
              title="User Management"
              aria-label="User Management"
            >
              <Users size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          )}
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-[10px] font-bold uppercase tracking-tighter opacity-50">Logged in as</span>
            <span className="text-xs font-semibold">{ROLE_DISPLAY[role || ''] || role}</span>
          </div>
          <button
            onClick={toggleDark}
            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
            title={dark ? 'Light Mode' : 'Dark Mode'}
            aria-label={dark ? 'Light Mode' : 'Dark Mode'}
          >
            {dark ? <Sun size={20} className="group-hover:scale-110 transition-transform" /> : <Moon size={20} className="group-hover:scale-110 transition-transform" />}
          </button>
          <button
            onClick={logout}
            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
            title="Lock App"
            aria-label="Lock App"
          >
            <Lock size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
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
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-spin"></div>
          <span className="uppercase tracking-widest text-[9px]">Connected</span>
        </div>
      </footer>

      {/* Bottom Navigation (mobile only) */}
      <BottomNav />
    </div>
  );
};

export default Layout;
