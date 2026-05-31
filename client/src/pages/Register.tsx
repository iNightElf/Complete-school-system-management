import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { UserPlus, ShieldAlert, MailCheck, School, KeyRound } from 'lucide-react';
import { SCHOOL_LOGO } from '../lib/logo';

const API_URL = '/api';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [setupMode, setSetupMode] = useState<boolean | null>(null);

  useEffect(() => {
    axios.get(`${API_URL}/setup/status`)
      .then(res => setSetupMode(!res.data.adminExists && res.data.setupTokenRequired))
      .catch(() => setSetupMode(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (setupMode) {
        const res = await axios.post(
          `${API_URL}/setup/init`,
          { name, email, password, token: setupToken },
          { withCredentials: true }
        );
        if (res.data?.error) {
          setError(res.data.error);
          return;
        }
        setRegistered(true);
      } else {
        const res = await axios.post(
          `${API_URL}/auth/sign-up/email`,
          { name, email, password },
          { withCredentials: true }
        );
        if (res.data?.error) {
          setError(res.data.error.message || 'Failed to register.');
          return;
        }
        setRegistered(true);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.error?.message || 'Failed to register. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-school-primary via-school-secondary to-school-accent2 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        <div className="bg-school-paper rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-school-primary to-school-secondary p-8 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 [mask-image:radial-gradient(ellipse_at_top,transparent_30%,black_70%)]" />
            <div className="relative">
              <img src={SCHOOL_LOGO} alt="AL RAWA" className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-white/20 shadow-lg object-cover" />
              <h1 className="font-serif text-2xl">AL RAWA</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-60 mt-1">English School</p>
            </div>
          </div>

          {registered ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <MailCheck size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-school-primary">
                {setupMode ? 'Setup Complete' : 'Check Your Email'}
              </h2>
              <p className="text-sm text-school-muted">
                {setupMode ? (
                  <>Admin user <span className="font-semibold text-school-primary">{email}</span> created. You can now sign in.</>
                ) : (
                  <>We sent a verification link to<br />
                  <span className="font-semibold text-school-primary">{email}</span></>
                )}
              </p>
              <Link to="/login"
                className="inline-block w-full bg-gradient-to-r from-school-primary to-school-secondary hover:from-school-secondary hover:to-school-primary text-white font-bold py-4 rounded-xl shadow-lg transition-all text-center"
              >
                Go to Sign In
              </Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="p-7 space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-school-paper px-4 py-1.5 rounded-full border border-school-border">
                <School size={14} className="text-school-accent" />
                <span className="text-[10px] font-bold uppercase text-school-muted tracking-wider">
                  {setupMode ? 'Initial Setup' : 'Staff Registration'}
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-xl flex items-center gap-3 text-sm shake-1">
                <ShieldAlert size={20} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {setupMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                No admin user exists yet. Enter the setup token from your server administrator to create the first admin account.
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Full Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-school-border p-3 rounded-xl focus:ring-2 focus:ring-school-accent focus:border-transparent outline-none transition-all text-sm"
                  placeholder="John Doe" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Email Address</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-school-border p-3 rounded-xl focus:ring-2 focus:ring-school-accent focus:border-transparent outline-none transition-all text-sm"
                  placeholder="staff@alrawa.edu" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-school-border p-3 rounded-xl focus:ring-2 focus:ring-school-accent focus:border-transparent outline-none transition-all text-sm"
                  placeholder="••••••••" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Confirm Password</label>
                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white border border-school-border p-3 rounded-xl focus:ring-2 focus:ring-school-accent focus:border-transparent outline-none transition-all text-sm"
                  placeholder="••••••••" />
              </div>
              {setupMode && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-school-muted ml-1 flex items-center gap-1">
                    <KeyRound size={12} /> Setup Token
                  </label>
                  <input type="text" value={setupToken} onChange={(e) => setSetupToken(e.target.value)}
                    className="w-full bg-white border border-school-border p-3 rounded-xl focus:ring-2 focus:ring-school-accent focus:border-transparent outline-none transition-all text-sm font-mono"
                    placeholder="Enter the setup token from your server admin" />
                </div>
              )}
            </div>

            <button type="submit" disabled={loading || setupMode === null}
              className="w-full bg-gradient-to-r from-school-primary to-school-secondary hover:from-school-secondary hover:to-school-primary text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><UserPlus size={18} /><span>{setupMode ? 'Complete Setup' : 'Register'}</span></>
              )}
            </button>

            <p className="text-center text-xs text-school-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-school-accent font-semibold hover:underline">Sign In</Link>
            </p>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
