import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuthStore, useDarkMode } from '../store';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { LogIn, ShieldAlert, School, BookOpen, Sun, Moon } from 'lucide-react';
import { SCHOOL_LOGO } from '../lib/logo';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fetchSession = useAuthStore((state) => state.fetchSession);
  const { dark, toggle: toggleDark } = useDarkMode();

  useEffect(() => { document.title = 'Login - AL RAWA English School'; }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      if (data?.user) {
        await fetchSession();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-school-primary via-school-secondary to-school-accent2 flex items-center justify-center p-4">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        <div className="bg-school-paper rounded-3xl shadow-2xl overflow-hidden">
          {/* Brand Header */}
          <div className="bg-gradient-to-r from-school-primary to-school-secondary p-8 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 [mask-image:radial-gradient(ellipse_at_top,transparent_30%,black_70%)]" />
            <button
              onClick={toggleDark}
              className="absolute top-3 right-3 p-2 hover:bg-white/10 rounded-full transition-colors group z-10"
              title={dark ? 'Light Mode' : 'Dark Mode'}
              aria-label={dark ? 'Light Mode' : 'Dark Mode'}
            >
              {dark ? <Sun size={18} className="group-hover:scale-110 transition-transform" /> : <Moon size={18} className="group-hover:scale-110 transition-transform" />}
            </button>
            <div className="relative">
              <img src={SCHOOL_LOGO} alt="AL RAWA" className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-white/20 shadow-lg object-cover" />
              <h1 className="font-serif text-2xl">AL RAWA</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-60 mt-1">English School</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-7 space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-school-paper px-4 py-1.5 rounded-full border border-school-border">
                <School size={14} className="text-school-accent" />
                <span className="text-[10px] font-bold uppercase text-school-muted tracking-wider">Staff Portal</span>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-xl flex items-center gap-3 text-sm shake-1">
                <ShieldAlert size={20} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Email</label>
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-school-border p-3 rounded-xl focus:ring-2 focus:ring-school-accent focus:border-transparent outline-none transition-all text-sm"
                  placeholder="staff@alrawa.edu"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Password</label>
                <input
                  type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-school-border p-3 rounded-xl focus:ring-2 focus:ring-school-accent focus:border-transparent outline-none transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-school-primary to-school-secondary hover:from-school-secondary hover:to-school-primary text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn size={18} /><span>Sign In</span></>
              )}
            </button>

            <div className="flex items-center gap-2 text-[10px] text-school-muted justify-center">
              <BookOpen size={12} />
              <span>Authorized personnel only</span>
            </div>

            <p className="text-center text-xs text-school-muted">
              New staff?{' '}
              <Link to="/register" className="text-school-accent font-semibold hover:underline">Register here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
