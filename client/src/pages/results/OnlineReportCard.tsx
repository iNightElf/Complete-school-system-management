
import { useSchoolStore } from '../../store';
import { Download, User, CalendarDays, MessageSquare } from 'lucide-react';
import { gradeFromMarks, gradeChip, gpaToGrade, calcTermRanks, calcYearRanks, calcYearSummary, calcAttendPct } from '../../lib/grading';
import { downloadReportCardPDF } from '../../lib/reportPdf';
import { SCHOOL_LOGO } from '../../lib/logo';

const API_URL = '/api';
const TERM_NAMES: Record<string, string> = { '1': '1st Term', '2': '2nd Term', '3': 'Final Exam' };

export default function OnlineReportCard({ student, cls, subjects, allResults, term, onBack }: { student: any; cls: any; subjects: any[]; allResults: any[]; term: string; onBack: () => void }) {
  const isFinal = term === 'final';
  const label = isFinal ? 'Annual Result' : TERM_NAMES[term];
  const clsStudents = useSchoolStore((s) => s.students).filter((s: any) => s.class === cls.name);
  const ranks = isFinal ? calcYearRanks(clsStudents, subjects, allResults) : calcTermRanks(clsStudents, term, subjects, allResults);


  const res = allResults.find((r: any) => r.studentId === student.id && r.term === (isFinal ? '3' : term));

  const subjRows = subjects.map(sub => {
    if (isFinal) {
      const getM = (t: string) => { const r = allResults.find((x: any) => x.studentId === student.id && x.term === t); const m = r?.marks?.[sub.name]; return (m !== undefined && m !== null) ? +m : null; };
      const m1 = getM('1'), m2 = getM('2'), m3 = getM('3');
      const vals = [m1, m2, m3].filter(m => m !== null) as number[];
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      const g = avg !== null ? gradeFromMarks(avg, sub.fullMarks) : null;
      return { name: sub.name, fullMarks: sub.fullMarks, m1, m2, m3, avg, grade: g?.grade || '—', gpa: g?.gpa ?? null };
    } else {
      const m = res?.marks?.[sub.name];
      const obt = (m !== undefined && m !== null) ? +m : null;
      const g = obt !== null ? gradeFromMarks(obt, sub.fullMarks) : null;
      return { name: sub.name, fullMarks: sub.fullMarks, obt, grade: g?.grade || '—', gpa: g?.gpa ?? null };
    }
  });

  let hasF = false; const gpas: number[] = [];
  if (!isFinal) {
    subjects.forEach((sub: any) => {
      const m = res?.marks?.[sub.name];
      if (m !== undefined && m !== null) { const g = gradeFromMarks(+m, sub.fullMarks); gpas.push(g.gpa); if (g.grade === 'F') hasF = true; }
    });
  }
  const termGPA = gpas.length ? gpas.reduce((a, b) => a + b, 0) / gpas.length : null;
  const termGrade = hasF ? 'F' : termGPA !== null ? gpaToGrade(termGPA) : '—';
  const { finalGPA } = calcYearSummary(student.id, subjects, allResults);
  const finalGrade = finalGPA !== null ? gpaToGrade(finalGPA) : '—';
  const termRank = !isFinal ? (calcTermRanks(clsStudents, term, subjects, allResults)[student.id] || '—') : '—';
  const yearRank = ranks[student.id] || '—';

  const attRows: { term: string; days: number; present: number; pct: string }[] = [];
  if (isFinal) {
    ['1', '2', '3'].forEach(t => { const r = allResults.find((x: any) => x.studentId === student.id && x.term === t); const att = r?.attendance; attRows.push({ term: TERM_NAMES[t], days: att?.days || 0, present: att?.present || 0, pct: calcAttendPct(att) }); });
  } else {
    const att = res?.attendance; attRows.push({ term: label, days: att?.days || 0, present: att?.present || 0, pct: calcAttendPct(att) });
  }
  const comment = res?.comment || '';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-school-accent hover:underline">← Change Term</button>
        <button onClick={async () => await downloadReportCardPDF(student, cls.name, subjects, allResults, term)} className="ml-auto flex items-center gap-1 px-4 py-2 bg-school-primary text-white rounded-xl text-xs font-bold hover:opacity-90"><Download size={14} /> Download PDF</button>
      </div>
        <div className="bg-white rounded-2xl border border-school-border max-w-2xl mx-auto space-y-5 p-6">
        <div className="text-center border-b border-school-border pb-4">
          <img src={SCHOOL_LOGO} alt="Logo" className="w-16 h-16 rounded-full object-cover mx-auto mb-2" />
          <h2 className="font-serif text-xl text-school-primary">AL RAWA English School</h2>
          <p className="text-[10px] text-school-muted mt-1">ESTD: 2022 · Read in the name of your Lord</p>
          <p className="text-sm font-bold text-red-600 mt-2">{isFinal ? 'ANNUAL REPORT CARD' : `TERM REPORT CARD — ${label.toUpperCase()}`}</p>
        </div>
        <div className="flex items-center gap-4">
          {student.hasPhoto ? <img src={`${API_URL}/students/${student.id}/photo`} alt="" className="w-16 h-16 rounded-full object-cover border border-school-border" /> : <div className="w-16 h-16 rounded-full bg-school-primary text-white flex items-center justify-center"><User size={24} className="text-white" /></div>}
          <div className="space-y-1 text-sm">
            <div><span className="text-school-muted">Student Name:</span> <strong>{student.name}</strong></div>
            <div><span className="text-school-muted">Class:</span> <strong>{cls.name}{student.roll ? ` · Roll: ${student.roll}` : ''}</strong></div>
            {student.fatherName && <div><span className="text-school-muted">Father:</span> {student.fatherName}</div>}
            {student.motherName && <div><span className="text-school-muted">Mother:</span> {student.motherName}</div>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-school-border">
            <thead><tr className="bg-school-primary text-white text-xs uppercase">
              {isFinal ? <>
                <th className="px-3 py-2 text-left">Subject</th><th className="px-2 py-2 text-center">1st</th><th className="px-2 py-2 text-center">2nd</th><th className="px-2 py-2 text-center">Final</th><th className="px-2 py-2 text-center">Average</th><th className="px-2 py-2 text-center">Grade</th><th className="px-2 py-2 text-center">GPA</th>
              </> : <>
                <th className="px-3 py-2 text-left">Subject</th><th className="px-2 py-2 text-center">Full</th><th className="px-2 py-2 text-center">Marks</th><th className="px-2 py-2 text-center">Grade</th><th className="px-2 py-2 text-center">GPA</th>
              </>}
            </tr></thead>
            <tbody>
              {subjRows.map((r, i) => (
                <tr key={i} className={`border-t border-school-border ${i % 2 ? 'bg-gray-50' : ''}`}>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  {isFinal ? <>
                    <td className="px-2 py-2 text-center">{r.m1 ?? '—'}</td><td className="px-2 py-2 text-center">{r.m2 ?? '—'}</td><td className="px-2 py-2 text-center">{r.m3 ?? '—'}</td>
                    <td className="px-2 py-2 text-center">{r.avg !== null && r.avg !== undefined ? (r.avg as number).toFixed(1) : '—'}</td>
                    <td className="px-2 py-2 text-center">{gradeChip(r.grade)}</td><td className="px-2 py-2 text-center">{r.gpa !== null && r.gpa !== undefined ? r.gpa.toFixed(2) : '—'}</td>
                  </> : <>
                    <td className="px-2 py-2 text-center">{r.fullMarks}</td><td className="px-2 py-2 text-center">{(r as any).obt ?? '—'}</td>
                    <td className="px-2 py-2 text-center">{gradeChip(r.grade)}</td><td className="px-2 py-2 text-center">{r.gpa !== null && r.gpa !== undefined ? r.gpa.toFixed(2) : '—'}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="bg-school-paper px-4 py-2 rounded-xl text-center flex-1">
            <div className="text-[10px] text-school-muted uppercase">{isFinal ? 'Annual GPA' : 'Term GPA'}</div>
            <div className="font-bold text-lg">{isFinal ? (finalGPA !== null ? finalGPA.toFixed(2) : '—') : (termGPA !== null ? termGPA.toFixed(2) : '—')}</div>
          </div>
          <div className="bg-school-paper px-4 py-2 rounded-xl text-center flex-1">
            <div className="text-[10px] text-school-muted uppercase">Grade</div>
            <div className="font-bold text-lg">{isFinal ? finalGrade : termGrade}</div>
          </div>
          <div className="bg-school-paper px-4 py-2 rounded-xl text-center flex-1">
            <div className="text-[10px] text-school-muted uppercase">{isFinal ? 'Year Rank' : 'Rank'}</div>
            <div className="font-bold text-lg">{isFinal ? yearRank : termRank}</div>
          </div>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-2 flex items-center gap-1.5"><CalendarDays size={16} /> Attendance</h4>
          <table className="w-full text-sm border border-school-border">
            <thead><tr className="bg-gray-100 text-xs uppercase"><th className="px-3 py-2 text-left">Term</th><th className="px-3 py-2 text-center">Days</th><th className="px-3 py-2 text-center">Present</th><th className="px-3 py-2 text-center">%</th></tr></thead>
            <tbody>{attRows.map((a, i) => <tr key={i} className="border-t border-school-border"><td className="px-3 py-2">{a.term}</td><td className="px-3 py-2 text-center">{a.days || '—'}</td><td className="px-3 py-2 text-center">{a.present || '—'}</td><td className="px-3 py-2 text-center font-bold">{a.pct}</td></tr>)}</tbody>
          </table>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-2 flex items-center gap-1.5"><MessageSquare size={16} /> Teacher's Comment</h4>
          <div className="border border-school-border rounded-xl p-3 text-sm min-h-[40px]">{comment || <em className="text-school-muted">No comment added.</em>}</div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-school-border">
          {['Class Teacher', 'Co-ordinator', 'Principal'].map((label) => (
            <div key={label} className="text-center">
              <div className="border-b border-gray-400 mb-2 h-8"></div>
              <div className="text-[10px] text-school-muted uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
