import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { supabase } from './lib/supabase';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './pages/NotFound';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-school-paper flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-school-primary/20 border-t-school-primary rounded-full animate-spin"></div>
    </div>
  );
}

const App: React.FC = () => {
  const { user, loading, fetchSession } = useAuthStore();

  useEffect(() => {
    fetch('/api/wake-db').catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        fetchSession();
      }
      if (event === 'SIGNED_OUT') {
        useAuthStore.setState({ user: null });
      }
    });
    return () => subscription?.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Router>
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/users" element={user?.role === 'admin' ? <UserManagement /> : <Navigate to="/" />} />
          <Route path="/audit" element={user?.role === 'admin' ? <AuditLogs /> : <Navigate to="/" />} />
          <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </Router>
  );
};

export default App;
