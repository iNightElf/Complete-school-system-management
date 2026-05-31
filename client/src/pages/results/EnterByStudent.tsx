import React, { useState, useEffect, useRef } from 'react';
import { useSchoolStore, useAuthStore } from '../../store';
import { toast } from '../../components/Toast';
import ClassSelect from '../../components/ClassSelect';
import { gradeFromMarks, gradeChip, gpaToGrade, calcTermSummary, calcTermRanks, calcAttendPct } from '../../lib/grading';
import OnlineReportCard from './OnlineReportCard';

const API_URL = '/api';
const TERM_NAMES: Record<string, string> = { '1': '1st Term', '2': '2nd Term', '3': 'Final Exam' };

export default function EnterByStudent() {
  const { students, fetchStudents, subjects, fetchSubjects, saveStudentResult } = useSchoolStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';
  const [cls, setCls] = useState<any>(null);
  const [activeStudent, setActiveStudent] = useState<any>(null);
  const [activeTerm, setActiveTerm] = useState('1');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState({ days: '', present: '' });
  const [comment, setComment] = useState('');
  const [allResults, setAllResults] = useState<any[]>([]);
  const [reportTerm, setReportTerm] = useState<string | null>(null);
  const saveTimer = useRef<any>(null);

  useEffect(() => { return () => { clearTimeout(saveTimer.current); }; }, []);

  const loadResults = async (clsId: string) => {
    try { const res = await fetch(`${API_URL}/classes/${clsId}/results`, { credentials: 'include' }); setAllResults(await res.json()); } catch { setAllResults([]); }
  };

  const handleSelectClass = (c: any) => { setCls(c); setActiveStudent(null); fetchSubjects(c.id); fetchStudents(); loadResults(c.id); };

  const clsStudents = cls ? students.filter((s: any) => s.class === cls.name).sort((a: any, b: any) => (+a.roll || 999) - (+b.roll || 999) || a.name.localeCompare(b.name)) : [];

  const result = activeStudent ? allResults.find((r: any) => r.studentId === activeStudent.id && r.term === activeTerm) : null;

  useEffect(() => {
    if (!activeStudent) return;
    if (result?.marks) { const m: Record<string, string> = {}; Object.entries(result.marks).forEach(([k, v]) => { m[k] = String(v); }); setMarks(m); } else { setMarks({}); }
    if (result?.attendance) { setAttendance({ days: String(result.attendance.days || ''), present: String(result.attendance.present || '') }); } else { setAttendance({ days: '', present: '' }); }
    setComment(result?.comment || '');
  }, [activeStudent, activeTerm, allResults.length]);

  const ranks = activeStudent ? calcTermRanks(clsStudents, activeTerm, subjects, allResults) : {};
  const myRank = activeStudent ? (ranks[activeStudent.id] || '—') : '—';

  let totalObt = 0, totalFull = 0, gpas: number[] = [], hasF = false;
  subjects.forEach((sub: any) => { const v = marks[sub.name]; if (v !== '' && v !== undefined && !isNaN(+v)) { const g = gradeFromMarks(+v, sub.fullMarks); gpas.push(g.gpa); if (g.grade === 'F') hasF = true; totalObt += +v; totalFull += sub.fullMarks; } });
  const termGPA = gpas.length ? gpas.reduce((a, b) => a + b, 0) / gpas.length : null;
  const termGrade = hasF ? 'F' : termGPA !== null ? gpaToGrade(termGPA) : '—';
  const attendPct = attendance.days && parseInt(attendance.days) > 0 ? ((parseInt(attendance.present) / parseInt(attendance.days)) * 100).toFixed(1) + '%' : '—';

  const save = async (m: Record<string, string>, att: { days: string; present: string }, cmt: string) => {
    const marksData: Record<string, number> = {};
    subjects.forEach((sub: any) => { const v = m[sub.name]; if (v !== '' && v !== undefined && !isNaN(+v)) marksData[sub.name] = Math.min(+v, sub.fullMarks); });
    const days = parseInt(att.days) || 0;
    const present = parseInt(att.present) || 0;
    const attendanceData = days > 0 ? { days, present } : undefined;
    await saveStudentResult(activeStudent.id, activeTerm, marksData, attendanceData, cmt);
  };

  const handleMarksChange = (subjName: string, value: string, fullMarks: number) => {
    if (!isNaN(parseFloat(value)) && parseFloat(value) > fullMarks) toast(`Max marks is ${fullMarks}`, 'error');
    const next = { ...marks, [subjName]: value };
    setMarks(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(next, attendance, comment), 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]"><label className="text-xs text-school-muted mb-1 block">Class</label><ClassSelect value={cls?.id || ''} onChange={handleSelectClass} /></div>
      </div>

      {!cls && <div className="text-center py-12 text-sm text-school-muted">Select a class to begin.</div>}
      {cls && !activeStudent && (
        <div className="space-y-3">
          <p className="text-sm text-school-muted">Select a student:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clsStudents.map((s: any) => {
              const tc = calcTermSummary(s.id, '1', subjects, allResults);
              return (
                <button key={s.id} onClick={() => { setActiveStudent(s); setActiveTerm('1'); }} className="bg-white p-4 rounded-2xl border border-school-border hover:shadow-md transition-shadow text-left">
                  <div className="flex items-center gap-3">
                    {s.hasPhoto ? <img src={`${API_URL}/students/${s.id}/photo`} alt="" className="w-10 h-10 rounded-full object-cover border border-school-border" /> : <div className="w-10 h-10 rounded-full bg-school-primary text-white flex items-center justify-center text-sm">👤</div>}
                    <div>
                      <div className="font-bold text-sm text-school-primary">{s.name}</div>
                      <div className="text-[11px] text-school-muted">{s.roll ? `Roll: ${s.roll}` : cls.name}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2">{tc ? gradeChip(tc.grade) : <span className="text-[10px] text-school-muted">No marks</span>}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {cls && activeStudent && !reportTerm && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveStudent(null)} className="text-sm text-school-accent hover:underline">← Students</button>
            {activeStudent.hasPhoto ? <img src={`${API_URL}/students/${activeStudent.id}/photo`} alt="" className="w-10 h-10 rounded-full object-cover border border-school-border" /> : <div className="w-10 h-10 rounded-full bg-school-primary text-white flex items-center justify-center text-sm">👤</div>}
            <div className="flex-1">
              <div className="font-bold text-sm text-school-primary">{activeStudent.name}</div>
              <div className="text-[11px] text-school-muted">{cls.name}{activeStudent.roll ? ` · Roll: ${activeStudent.roll}` : ''}</div>
            </div>
            <button onClick={() => setReportTerm('pick')} className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:opacity-90">📄 Report Card</button>
          </div>
          <div className="flex gap-2">
            {['1', '2', '3'].map(t => <button key={t} onClick={() => setActiveTerm(t)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTerm === t ? 'bg-school-primary text-white shadow-lg' : 'bg-white border border-school-border hover:border-school-accent'}`}>{TERM_NAMES[t]}</button>)}
          </div>
          <div className="bg-white rounded-2xl border border-school-border p-4">
            <h4 className="font-serif text-sm text-school-primary mb-3">{TERM_NAMES[activeTerm]}</h4>
            {subjects.length === 0 ? <div className="text-center py-8 text-school-muted"><p className="text-sm">No subjects set up.</p></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-school-muted text-xs uppercase border-b border-school-border">
                    <th className="text-left pb-2">Subject</th><th className="text-right pb-2">Full</th><th className="text-right pb-2">Marks</th><th className="text-center pb-2">Grade</th><th className="text-right pb-2">GPA</th>
                  </tr></thead>
                  <tbody>
                    {subjects.map((sub: any) => {
                      const v = marks[sub.name]; const g = v !== '' && v !== undefined && !isNaN(+v) ? gradeFromMarks(+v, sub.fullMarks) : null;
                      return <tr key={sub.id} className="border-b border-school-border/50">
                        <td className="py-2 font-medium">{sub.name}</td><td className="py-2 text-right">{sub.fullMarks}</td>
                        <td className="py-2 text-right"><input type="number" min="0" max={sub.fullMarks} value={v || ''} onChange={(e) => handleMarksChange(sub.name, e.target.value, sub.fullMarks)} placeholder="—" className={`w-16 px-2 py-1 border rounded text-right text-sm focus:outline-none focus:border-school-accent ${!isNaN(parseFloat(v)) && parseFloat(v) > sub.fullMarks ? 'border-red-500' : 'border-school-border'}`} /></td>
                        <td className="py-2 text-center">{g ? gradeChip(g.grade) : '—'}</td>
                        <td className="py-2 text-right">{g ? g.gpa.toFixed(2) : '—'}</td>
                      </tr>;
                    })}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-school-primary font-bold">
                    <td className="py-2 text-xs uppercase">Total</td><td className="py-2 text-right">{totalFull || '—'}</td><td className="py-2 text-right">{gpas.length ? totalObt : '—'}</td>
                    <td className="py-2 text-center">{gradeChip(termGrade)}</td><td className="py-2 text-right">{termGPA !== null ? termGPA.toFixed(2) : '—'}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
            {subjects.length > 0 && <div className="flex gap-3 mt-4 flex-wrap">
              <div className="bg-school-paper px-3 py-2 rounded-xl text-center"><div className="text-[10px] text-school-muted uppercase">Total</div><div className="font-bold text-sm">{gpas.length ? `${totalObt}/${totalFull}` : '—'}</div></div>
              <div className="bg-school-paper px-3 py-2 rounded-xl text-center"><div className="text-[10px] text-school-muted uppercase">GPA</div><div className="font-bold text-sm">{termGPA !== null ? termGPA.toFixed(2) : '—'}</div></div>
              <div className="bg-school-paper px-3 py-2 rounded-xl text-center"><div className="text-[10px] text-school-muted uppercase">Grade</div><div className="font-bold text-sm">{termGrade}</div></div>
              <div className="bg-school-paper px-3 py-2 rounded-xl text-center"><div className="text-[10px] text-school-muted uppercase">Rank</div><div className="font-bold text-sm">{myRank}</div></div>
            </div>}
            {isAdmin && <button onClick={async () => { await save(marks, attendance, comment); loadResults(cls.id); toast('Saved ✓', 'success'); }} className="w-full mt-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:opacity-90">💾 Save Marks</button>}
          </div>
          <div className="bg-white rounded-2xl border border-school-border p-4">
            <h4 className="font-bold text-sm mb-3">📅 Attendance</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs text-school-muted mb-1 block">Total Days</label><input type="number" min="0" value={attendance.days} onChange={(e) => setAttendance({ ...attendance, days: e.target.value })} placeholder="200" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" /></div>
              <div><label className="text-xs text-school-muted mb-1 block">Days Present</label><input type="number" min="0" value={attendance.present} onChange={(e) => setAttendance({ ...attendance, present: e.target.value })} placeholder="185" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" /></div>
              <div><label className="text-xs text-school-muted mb-1 block">Attendance</label><div className="px-3 py-2 bg-school-paper rounded-xl text-sm font-bold text-center">{attendPct}</div></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-school-border p-4">
            <h4 className="font-bold text-sm mb-3">💬 Teacher's Comment</h4>
            <textarea value={comment} onChange={(e) => { setComment(e.target.value); clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => save(marks, attendance, e.target.value), 500); }} rows={3} placeholder="Write about the student's performance…" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent resize-none" />
          </div>
        </div>
      )}
      {cls && activeStudent && reportTerm === 'pick' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setReportTerm(null)} className="text-sm text-school-accent hover:underline">← Back</button>
          </div>
          <div className="bg-white rounded-2xl border border-school-border p-6 text-center space-y-4">
            <div className="font-serif text-lg text-school-primary">{activeStudent.name}</div>
            <p className="text-sm text-school-muted">Which term report card?</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => setReportTerm('1')} className="min-w-[130px] px-6 py-3 border border-school-border rounded-xl text-sm font-bold hover:border-school-accent transition-all">📝 1st Term</button>
              <button onClick={() => setReportTerm('2')} className="min-w-[130px] px-6 py-3 border border-school-border rounded-xl text-sm font-bold hover:border-school-accent transition-all">📝 2nd Term</button>
              <button onClick={() => setReportTerm('final')} className="min-w-[130px] px-6 py-3 bg-school-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all">🏆 Annual Result</button>
            </div>
          </div>
        </div>
      )}
      {cls && activeStudent && reportTerm && reportTerm !== 'pick' && (
        <OnlineReportCard student={activeStudent} cls={cls} subjects={subjects} allResults={allResults} term={reportTerm} onBack={() => setReportTerm('pick')} />
      )}
    </div>
  );
}
