import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUIStore, useSchoolStore, useAuthStore } from '../store';
import Layout from '../components/Layout';
import Toast from '../components/Toast';
import IdCardSection from './IdCardSection';
import AccessoriesSection from './AccessoriesSection';
import ResultSection from './ResultSection';
import FinanceSection from './FinanceSection';
import { CreditCard, BookOpen, BarChart3, Wallet, Users, GraduationCap, Building2, Sparkles, ArrowRight } from 'lucide-react';
import { SCHOOL_LOGO } from '../lib/logo';

type ModeParam = 'idcard' | 'accessories' | 'result' | 'finance';

function TodaysGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const Dashboard = () => {
  const { activeMode, setMode } = useUIStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { students, teachers, staff, studentTotal, fetchClasses, fetchStudents, fetchTeachers, fetchStaff, fetchBooks } = useSchoolStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => { document.title = 'Dashboard - AL RAWA English School'; }, []);
  useEffect(() => {
    fetchClasses();
    fetchStudents();
    fetchTeachers();
    fetchStaff();
    fetchBooks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const urlMode = searchParams.get('mode') as ModeParam | null;
    if (urlMode && urlMode !== activeMode) setMode(urlMode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetMode = (mode: ModeParam | null) => {
    setMode(mode);
    if (mode) setSearchParams({ mode }, { replace: false });
    else setSearchParams({}, { replace: false });
  };

  const MODULES = [
    { key: 'idcard' as ModeParam, label: 'ID Card', desc: 'Students, Teachers & Staff', color: 'blue', icon: CreditCard },
    { key: 'accessories' as ModeParam, label: 'Fees & Books', desc: 'Fee structure & book list', color: 'amber', icon: BookOpen },
    { key: 'result' as ModeParam, label: 'Result', desc: 'Marks & report cards', color: 'green', icon: BarChart3 },
    { key: 'finance' as ModeParam, label: 'Finance', desc: 'Accounting & fees', color: 'rose', icon: Wallet },
  ];

  return (
    <Layout>
      <Toast />

      {!activeMode ? (
        <div className="space-y-5 animate-fade-in">
          {/* Welcome Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-school-primary via-school-secondary to-school-accent2 p-6 text-white">
            <div className="absolute inset-0 bg-white/5 [mask-image:radial-gradient(ellipse_at_top_right,black_30%,transparent_70%)]" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="relative flex items-center gap-4">
              <button onClick={() => handleSetMode(null)} className="hidden sm:block">
                <img src={SCHOOL_LOGO} alt="" className="w-14 h-14 rounded-full border-2 border-white/20 shadow-lg object-cover cursor-pointer hover:scale-105 transition-transform" />
              </button>
              <div className="flex-1">
                <p className="text-sm text-white/70 font-medium">{TodaysGreeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</p>
                <h1 className="font-serif text-xl sm:text-2xl mt-0.5">AL RAWA English School</h1>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-[10px] text-white/50 uppercase tracking-wider bg-white/10 px-3 py-1.5 rounded-full">
                <Sparkles size={12} />
                <span>{new Date().getFullYear()} Session</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: GraduationCap, value: studentTotal || students.length, label: 'Students', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
              { icon: Users, value: teachers.length, label: 'Teachers', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
              { icon: Building2, value: staff.length, label: 'Staff', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10' },
            ].map((s) => (
              <div key={s.label} className="bg-white dark:bg-[#1a1a2e] rounded-xl border border-school-border dark:border-[#2a2a3e] p-4 card-shadow">
                <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-2`}>
                  <s.icon size={18} className={s.color} />
                </div>
                <div className="font-bold text-lg text-school-primary dark:text-[#e0e0e8]">{s.value}</div>
                <div className="text-[10px] text-school-muted uppercase tracking-wider font-bold">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Module Tiles */}
          <div className="grid grid-cols-2 gap-3">
            {MODULES.map((m) => {
              const Icon = m.icon;
              const bgMap: Record<string, string> = { blue: 'from-blue-500 to-blue-700', amber: 'from-amber-500 to-orange-700', green: 'from-green-500 to-emerald-700', rose: 'from-rose-500 to-rose-700' };
              return (
                <button key={m.key} onClick={() => handleSetMode(m.key)}
                  className="group relative bg-white dark:bg-[#1a1a2e] p-5 rounded-2xl border border-school-border dark:border-[#2a2a3e] text-left card-shadow overflow-hidden"
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${bgMap[m.color]} text-white rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm`}>
                    <Icon size={24} />
                  </div>
                  <div className="font-bold text-sm text-school-primary dark:text-[#e0e0e8]">{m.label}</div>
                  <div className="text-[11px] text-school-muted mt-0.5">{m.desc}</div>
                  <ArrowRight size={14} className="absolute bottom-4 right-4 text-school-muted opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
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
