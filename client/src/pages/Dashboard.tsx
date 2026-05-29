import React from 'react';
import { useSchoolStore } from '../store';
import { GraduationCap, Users, UserCog, BookOpen, Wallet, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { balances } = useSchoolStore();

  const menuItems = [
    { id: 'students', label: 'Students', desc: 'Manage student records', icon: GraduationCap, color: 'bg-blue-500', path: '/students' },
    { id: 'teachers', label: 'Teachers', desc: 'Faculty management', icon: Users, color: 'bg-emerald-500', path: '/teachers' },
    { id: 'staff', label: 'Staff', desc: 'Operational personnel', icon: UserCog, color: 'bg-indigo-500', path: '/staff' },
    { id: 'books', label: 'Book List', desc: 'Inventory & pricing', icon: BookOpen, color: 'bg-amber-600', path: '/books' },
    { id: 'finance', label: 'Finance', desc: 'Accounting & transfers', icon: Wallet, color: 'bg-rose-500', path: '/finance' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Finance Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'AL RAWA Bank', amount: balances.AL_RAWA_BANK, id: 'AL_RAWA_BANK' },
          { label: 'Global Forum', amount: balances.GLOBAL_FORUM_BANK, id: 'GLOBAL_FORUM_BANK' },
          { label: 'Cash in Hand', amount: balances.CASH_IN_HAND, id: 'CASH_IN_HAND' },
        ].map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-2xl border border-school-border shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] uppercase tracking-wider text-school-muted font-bold mb-1">{item.label}</p>
            <p className="text-2xl font-serif text-school-primary">
              ৳ {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </section>

      {/* Navigation Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg text-school-primary">Main Menu</h3>
          <span className="text-[10px] text-school-muted uppercase font-bold tracking-widest">Select a module</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="group relative bg-white p-5 rounded-2xl border border-school-border text-left hover:border-school-accent transition-all duration-300 overflow-hidden"
            >
              <div className={`absolute top-0 left-0 w-1.5 h-full ${item.color} group-hover:w-full group-hover:opacity-5 transition-all duration-300`}></div>
              <div className="flex items-center gap-4">
                <div className={`${item.color} p-3 rounded-xl text-white shadow-lg shadow-black/5`}>
                  <item.icon size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-school-primary group-hover:text-school-accent transition-colors">{item.label}</h4>
                  <p className="text-xs text-school-muted">{item.desc}</p>
                </div>
                <ChevronRight size={18} className="text-school-border group-hover:text-school-accent transition-all transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Quick Actions / Recent Activity Placeholder */}
      <section className="bg-school-primary/5 p-6 rounded-3xl border border-school-primary/10">
        <h3 className="font-serif text-lg text-school-primary mb-2">School Status</h3>
        <p className="text-sm text-school-muted max-w-md">
          Welcome back. All systems are operational. You have full access to student records and financial management.
        </p>
      </section>
    </div>
  );
};

export default Dashboard;
