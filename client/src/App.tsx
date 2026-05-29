import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import Finance from './pages/Finance';
import Teachers from './pages/Teachers';
import Staff from './pages/Staff';
import Books from './pages/Books';

const App: React.FC = () => {
  const { token } = useAuthStore();

  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route 
          path="/login" 
          element={!token ? <Login /> : <Navigate to="/" />} 
        />

        {/* Protected Routes */}
        <Route 
          path="/" 
          element={token ? <Layout><Dashboard /></Layout> : <Navigate to="/login" />} 
        />
        
        <Route path="/students" element={token ? <Layout title="Students" showBack><Students /></Layout> : <Navigate to="/login" />} />
        <Route path="/students/:id" element={token ? <StudentDetail /> : <Navigate to="/login" />} />
        <Route path="/teachers" element={token ? <Teachers /> : <Navigate to="/login" />} />
        <Route path="/staff" element={token ? <Staff /> : <Navigate to="/login" />} />
        <Route path="/books" element={token ? <Books /> : <Navigate to="/login" />} />
        <Route path="/finance" element={token ? <Layout title="Finance" showBack><Finance /></Layout> : <Navigate to="/login" />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;
