import React, { useState } from 'react';
import { useAuthStore } from '../store';
import axios from 'axios';
import { LogIn, ShieldAlert } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fetchSession = useAuthStore((state) => state.fetchSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/auth/sign-in/email`,
        { email, password },
        { withCredentials: true }
      );
      if (res.data?.error) {
        setError(res.data.error.message || 'Invalid credentials.');
        return;
      }
      await fetchSession();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-school-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-school-paper rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-school-secondary p-8 text-white text-center">
          <h1 className="font-serif text-3xl mb-1">AL RAWA</h1>
          <p className="text-xs uppercase tracking-[0.3em] opacity-60">English School</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-school-primary mb-1 text-center">Staff Login</h2>
            <p className="text-xs text-school-muted text-center mb-6">Enter your credentials to continue</p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-xl flex items-center gap-3 text-sm animate-in shake-1 duration-300">
              <ShieldAlert size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-school-border p-3 rounded-xl focus:ring-2 focus:ring-school-accent focus:border-transparent outline-none transition-all"
                placeholder="staff@school.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-school-border p-3 rounded-xl focus:ring-2 focus:ring-school-accent focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-school-primary hover:bg-school-secondary text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn size={20} />
                <span>Sign In</span>
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-school-muted leading-relaxed">
            Authorized Personnel Only. All access is logged and monitored.<br/>
            Contact Admin if you forgot your credentials.
          </p>

          <p className="text-center text-xs text-school-muted">
            Don't have an account?{' '}
            <a href="/register" className="text-school-accent font-semibold hover:underline">Register</a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
