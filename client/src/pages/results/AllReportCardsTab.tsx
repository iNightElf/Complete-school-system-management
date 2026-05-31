import { useState } from 'react';
import { useSchoolStore } from '../../store';
import { toast } from '../../components/Toast';
import ClassSelect from '../../components/ClassSelect';
import { downloadReportCardPDF } from '../../lib/reportPdf';
import jsPDF from 'jspdf';
import { FileSpreadsheet, PenLine, Award } from 'lucide-react';

const API_URL = '/api';
const TERM_NAMES: Record<string, string> = { '1': '1st Term', '2': '2nd Term', '3': 'Final Exam' };

export default function AllReportCardsTab() {
  const { students, fetchStudents, subjects, fetchSubjects } = useSchoolStore();
  const [cls, setCls] = useState<any>(null);
  const [allResults, setAllResults] = useState<any[]>([]);

  const loadResults = async (clsId: string) => {
    try { const res = await fetch(`${API_URL}/classes/${clsId}/results`, { credentials: 'include' }); setAllResults(await res.json()); } catch { setAllResults([]); }
  };

  const handleSelectClass = (c: any) => { setCls(c); fetchSubjects(c.id); fetchStudents(); loadResults(c.id); };
  const clsStudents = cls ? students.filter((s: any) => s.class === cls.name).sort((a: any, b: any) => (+a.roll || 999) - (+b.roll || 999) || a.name.localeCompare(b.name)) : [];

  const downloadAll = async (term: string) => {
    if (!clsStudents.length) { toast('No students', 'error'); return; }
    toast(`Generating ${clsStudents.length} report cards…`, 'info');
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    for (const s of clsStudents) { await downloadReportCardPDF(s, cls.name, subjects, allResults, term, doc); }
    const isFinal = term === 'final';
    const label = isFinal ? 'Annual' : TERM_NAMES[term];
    doc.save(`${cls.name.replace(/\s+/g, '_')}_${label}_All_Reports.pdf`);
    toast('All report cards downloaded ✓', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]"><label className="text-xs text-school-muted mb-1 block">Class</label><ClassSelect value={cls?.id || ''} onChange={handleSelectClass} /></div>
      </div>
      {!cls && <div className="text-center py-12 text-sm text-school-muted">Select a class to download report cards.</div>}
      {cls && (
        <div className="bg-white rounded-2xl border border-school-border p-6 space-y-4">
          <h4 className="font-serif text-lg text-school-primary flex items-center gap-1.5"><FileSpreadsheet size={16} /> Download All Report Cards</h4>
          <p className="text-sm text-school-muted">Generate report cards for all {clsStudents.length} students in {cls.name}:</p>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => downloadAll('1')} className="px-4 py-2 border border-school-border rounded-xl text-sm font-bold hover:border-school-accent transition-all flex items-center gap-1.5"><PenLine size={14} /> 1st Term</button>
            <button onClick={() => downloadAll('2')} className="px-4 py-2 border border-school-border rounded-xl text-sm font-bold hover:border-school-accent transition-all flex items-center gap-1.5"><PenLine size={14} /> 2nd Term</button>
            <button onClick={() => downloadAll('final')} className="px-4 py-2 bg-school-primary text-white rounded-xl text-sm font-bold hover:opacity-90 flex items-center gap-1.5"><Award size={14} /> Annual Result</button>
          </div>
        </div>
      )}
    </div>
  );
}
