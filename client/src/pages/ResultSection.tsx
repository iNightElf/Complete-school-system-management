import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useUIStore } from '../store';
import EnterBySubject from './results/EnterBySubject';
import EnterByStudent from './results/EnterByStudent';
import TabulationTab from './results/TabulationTab';
import AllReportCardsTab from './results/AllReportCardsTab';
import { PenLine, User, ClipboardList, FileSpreadsheet } from 'lucide-react';

type Tab = 'subject' | 'student' | 'tabulation' | 'reports';

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'subject', label: 'Enter by Subject', icon: <PenLine size={14} /> },
  { key: 'student', label: 'Enter by Student', icon: <User size={14} /> },
  { key: 'tabulation', label: 'Tabulation', icon: <ClipboardList size={14} /> },
  { key: 'reports', label: 'Report Cards', icon: <FileSpreadsheet size={14} /> },
];

const ResultSection = () => {
  const [activeTab, setActiveTab] = useState<Tab>('subject');
  useEffect(() => { document.title = 'Results - AL RAWA English School'; }, []);
  useEffect(() => { useUIStore.getState().registerSwipeBack(() => setActiveTab('subject')); }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === t.key ? 'bg-school-primary text-white shadow-lg' : 'bg-white border border-school-border hover:border-school-accent'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'subject' && <EnterBySubject />}
      {activeTab === 'student' && <EnterByStudent />}
      {activeTab === 'tabulation' && <TabulationTab />}
      {activeTab === 'reports' && <AllReportCardsTab />}
    </div>
  );
};

export default ResultSection;
