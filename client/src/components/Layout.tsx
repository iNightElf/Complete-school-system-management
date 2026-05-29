import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from './store';
import { ChevronLeft, Lock } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, title, showBack = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, role } = useAuthStore();

  // Swipe gesture detection
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isRightSwipe) {
      // Right to Left (actually Left to Right swipe) -> Go Back
      navigate(-1);
    } else if (isLeftSwipe) {
      // Left to Right (actually Right to Left swipe) -> Go Forward
      window.history.forward();
    }
  };

  return (
    <div 
      className="min-h-screen bg-school-paper flex flex-col selection:bg-school-accent selection:text-white"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-school-primary text-school-paper shadow-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button 
              onClick={() => navigate(-1)}
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

      {/* Main Content with Page Transitions */}
      <main className="flex-1 overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-4 md:p-6 max-w-7xl mx-auto w-full"
          >
            {title && (
              <div className="mb-6">
                <h2 className="text-2xl font-serif text-school-primary">{title}</h2>
                <div className="h-1 w-12 bg-school-accent mt-1 rounded-full"></div>
              </div>
            )}
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer / Status Bar */}
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
