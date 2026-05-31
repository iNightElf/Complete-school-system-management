import React, { useState } from 'react';
import EnterBySubject from './results/EnterBySubject';
import EnterByStudent from './results/EnterByStudent';
import TabulationTab from './results/TabulationTab';
import AllReportCardsTab from './results/AllReportCardsTab';

type Tab = 'subject' | 'student' | 'tabulation' | 'reports';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'subject', label: 'Enter by Subject', icon: '📝' },
  { key: 'student', label: 'Enter by Student', icon: '👤' },
  { key: 'tabulation', label: 'Tabulation', icon: '📋' },
  { key: 'reports', label: 'Report Cards', icon: '📑' },
];

const ResultSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('subject');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === t.key ? 'bg-school-primary text-white shadow-lg' : 'bg-white border border-school-border hover:border-school-accent'}`}>
            <span>{t.icon}</span> {t.label}
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
