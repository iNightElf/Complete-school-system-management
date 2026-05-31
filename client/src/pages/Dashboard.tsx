import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUIStore, useSchoolStore } from '../store';
import Layout from '../components/Layout';
import Toast from '../components/Toast';
import IdCardSection from './IdCardSection';
import AccessoriesSection from './AccessoriesSection';
import ResultSection from './ResultSection';
import FinanceSection from './FinanceSection';
import { CreditCard, BookOpen, BarChart3, Wallet } from 'lucide-react';

type ModeParam = 'idcard' | 'accessories' | 'result' | 'finance';

const Dashboard: React.FC = () => {
  const { activeMode, setMode } = useUIStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { fetchClasses, fetchStudents, fetchTeachers, fetchStaff, fetchBooks, fetchFinance } = useSchoolStore();

  useEffect(() => {
    fetchClasses();
    fetchStudents();
    fetchTeachers();
    fetchStaff();
    fetchBooks();
    fetchFinance();
  }, []);

  // Sync URL param → store on mount
  useEffect(() => {
    const urlMode = searchParams.get('mode') as ModeParam | null;
    if (urlMode && urlMode !== activeMode) {
      setMode(urlMode);
    }
  }, []); // only on mount

  // Sync store → URL when mode changes
  const handleSetMode = (mode: ModeParam | null) => {
    setMode(mode);
    if (mode) {
      setSearchParams({ mode }, { replace: false });
    } else {
      setSearchParams({}, { replace: false });
    }
  };

  return (
    <Layout>
      <Toast />

      {!activeMode ? (
        /* ── Mode Selector (4 tiles) ── */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-8">
            <h2 className="font-serif text-2xl text-school-primary">Welcome to AL RAWA</h2>
            <p className="text-sm text-school-muted mt-1">Select a module to continue</p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
            <button
              onClick={() => handleSetMode('idcard')}
              className="group bg-white p-6 rounded-2xl border border-school-border text-center hover:border-blue-500 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-14 h-14 bg-blue-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <CreditCard size={28} />
              </div>
              <div className="font-bold text-sm text-school-primary">ID Card</div>
              <div className="text-[11px] text-school-muted mt-1">Students, Teachers & Staff</div>
            </button>

            <button
              onClick={() => handleSetMode('accessories')}
              className="group bg-white p-6 rounded-2xl border border-school-border text-center hover:border-amber-500 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-14 h-14 bg-amber-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <BookOpen size={28} />
              </div>
              <div className="font-bold text-sm text-school-primary">Accessories</div>
              <div className="text-[11px] text-school-muted mt-1">Books & pricing</div>
            </button>

            <button
              onClick={() => handleSetMode('result')}
              className="group bg-white p-6 rounded-2xl border border-school-border text-center hover:border-green-500 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-14 h-14 bg-green-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <BarChart3 size={28} />
              </div>
              <div className="font-bold text-sm text-school-primary">Result</div>
              <div className="text-[11px] text-school-muted mt-1">Marks & report cards</div>
            </button>

            <button
              onClick={() => handleSetMode('finance')}
              className="group bg-white p-6 rounded-2xl border border-school-border text-center hover:border-rose-500 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-14 h-14 bg-rose-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Wallet size={28} />
              </div>
              <div className="font-bold text-sm text-school-primary">Finance</div>
              <div className="text-[11px] text-school-muted mt-1">Accounting & fees</div>
            </button>
          </div>
        </div>
      ) : (
        /* ── Active Section ── */
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          {activeMode === 'idcard' && <IdCardSection />}
          {activeMode === 'accessories' && <AccessoriesSection />}
          {activeMode === 'result' && <ResultSection />}
          {activeMode === 'finance' && <FinanceSection />}
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;
