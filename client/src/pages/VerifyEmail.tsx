import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MailCheck, ShieldAlert } from 'lucide-react';

const VerifyEmail: React.FC = () => {
  useEffect(() => { document.title = 'Verify Email - AL RAWA English School'; }, []);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('No verification token found.');
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          setStatus('success');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setError(data.error?.message || 'Verification failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setError('Network error. Please try again.');
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-school-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-school-paper rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-school-secondary p-8 text-white text-center">
          <h1 className="font-serif text-3xl mb-1">AL RAWA</h1>
          <p className="text-xs uppercase tracking-[0.3em] opacity-60">English School</p>
        </div>
        <div className="p-8 text-center space-y-4">
          {status === 'loading' && (
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <MailCheck size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-school-primary">Email Verified!</h2>
              <p className="text-sm text-school-muted">Redirecting to sign in...</p>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert size={32} className="text-rose-600" />
              </div>
              <h2 className="text-xl font-bold text-school-primary">Verification Failed</h2>
              <p className="text-sm text-school-muted">{error}</p>
              <a href="/login" className="inline-block w-full bg-school-primary text-white font-bold py-4 rounded-xl text-center">
                Go to Sign In
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
