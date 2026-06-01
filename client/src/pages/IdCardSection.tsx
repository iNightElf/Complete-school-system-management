import { useEffect } from 'react';
import { useUIStore } from '../store';
import { GraduationCap, Building2 } from 'lucide-react';
import StudentSection from './students/StudentSection';
import TeacherSection from './teachers/TeacherSection';
import StaffSection from './staff/StaffSection';

const IdCardSection = () => {
  useEffect(() => { document.title = 'ID Cards - AL RAWA English School'; }, []);
  const { activeSubMode, setIdSubMode } = useUIStore();

  const tabs = [
    { id: 'student' as const, label: <><GraduationCap size={14} /> Students</>, color: 'bg-blue-600' },
    { id: 'teacher' as const, label: <><GraduationCap size={14} /> Teachers</>, color: 'bg-emerald-600' },
    { id: 'staff' as const, label: <><Building2 size={14} /> Staff</>, color: 'bg-indigo-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setIdSubMode(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeSubMode === tab.id
                ? `${tab.color} text-white shadow-lg`
                : 'bg-white border border-school-border text-school-primary hover:border-school-accent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubMode === 'student' && <StudentSection />}
      {activeSubMode === 'teacher' && <TeacherSection />}
      {activeSubMode === 'staff' && <StaffSection />}
    </div>
  );
};

export default IdCardSection;
