import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  useEffect(() => { document.title = '404 - Page Not Found - AL RAWA English School'; }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
      <div className="text-6xl font-bold text-school-primary">404</div>
      <p className="text-gray-500 text-lg">Page not found</p>
      <button onClick={() => navigate('/')} className="btn-primary flex items-center gap-2">
        <Home size={18} /> Back to Dashboard
      </button>
    </div>
  );
}
