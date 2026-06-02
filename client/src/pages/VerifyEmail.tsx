import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';

const VerifyEmail = () => {
  useEffect(() => { document.title = 'Verify Email - AL RAWA English School'; }, []);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/login'), 4000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-school-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-school-paper rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-school-secondary p-8 text-white text-center">
          <h1 className="font-serif text-3xl mb-1">AL RAWA</h1>
          <p className="text-xs uppercase tracking-[0.3em] opacity-60">English School</p>
        </div>
        <div className="p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <MailCheck size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-school-primary">Email Verified!</h2>
          <p className="text-sm text-school-muted">Redirecting to sign in...</p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
