import React, { useState, useEffect, useRef } from 'react';
import { useSchoolStore, useAuthStore } from '../store';
import { toast } from '../components/Toast';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { SCHOOL_LOGO } from '../lib/logo';

const API_URL = '/api';
const TERM_NAMES: Record<string, string> = { '1': '1st Term', '2': '2nd Term', '3': 'Final Exam' };

// ── Grading ──
function getGrade(pct: number) {
  if (pct >= 80) return { grade: 'A+', gpa: 5.00 };
  if (pct >= 75) return { grade: 'A', gpa: 4.75 };
  if (pct >= 70) return { grade: 'A-', gpa: 4.50 };
  if (pct >= 65) return { grade: 'B+', gpa: 4.25 };
  if (pct >= 60) return { grade: 'B', gpa: 4.00 };
  if (pct >= 55) return { grade: 'B-', gpa: 3.75 };
  if (pct >= 50) return { grade: 'C+', gpa: 3.50 };
  if (pct >= 45) return { grade: 'C', gpa: 3.25 };
  if (pct >= 40) return { grade: 'D', gpa: 3.00 };
  return { grade: 'F', gpa: 0.00 };
}
function gradeFromMarks(o: number, f: number) { return f <= 0 ? { grade: '—', gpa: 0 } : getGrade((o / f) * 100); }
function gpaToGrade(g: number) {
  if (g >= 5.00) return 'A+'; if (g >= 4.75) return 'A'; if (g >= 4.50) return 'A-';
  if (g >= 4.25) return 'B+'; if (g >= 4.00) return 'B'; if (g >= 3.75) return 'B-';
  if (g >= 3.50) return 'C+'; if (g >= 3.25) return 'C'; if (g >= 3.00) return 'D';
  return 'F';
}
function gradeColor(g: string) {
  if (g.startsWith('A')) return 'bg-green-100 text-green-700';
  if (g.startsWith('B')) return 'bg-blue-100 text-blue-700';
  if (g.startsWith('C')) return 'bg-yellow-100 text-yellow-700';
  if (g === 'D') return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}
function gradeChip(g: string) { return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeColor(g)}`}>{g}</span>; }

// ── Ranking helpers ──
function calcTermSummary(studentId: string, term: string, subjects: any[], allResults: any[]) {
  const r = allResults.find((x: any) => x.studentId === studentId && x.term === term);
  if (!r?.marks || !subjects.length) return null;
  let tot = 0, full = 0, gpas: number[] = [], hasF = false, n = 0;
  subjects.forEach((sub: any) => { const m = r.marks[sub.name]; if (m !== undefined && m !== null) { const g = gradeFromMarks(+m, sub.fullMarks); gpas.push(g.gpa); if (g.grade === 'F') hasF = true; tot += +m; full += sub.fullMarks; n++; } });
  if (!n) return null;
  const gpa = gpas.reduce((a, b) => a + b, 0) / gpas.length;
  return { gpa, grade: hasF ? 'F' : gpaToGrade(gpa), total: tot, fullTotal: full };
}
function calcTermRanks(clsStudents: any[], term: string, subjects: any[], allResults: any[]) {
  const scores = clsStudents.map(s => { const tc = calcTermSummary(s.id, term, subjects, allResults); return { sid: s.id, gpa: tc ? tc.gpa : -1, total: tc ? tc.total : -1 }; }).filter(x => x.gpa >= 0);
  scores.sort((a, b) => b.gpa - a.gpa || b.total - a.total);
  const ranks: Record<string, number> = {};
  scores.forEach((sc, i) => { const p = scores[i - 1]; ranks[sc.sid] = (i > 0 && sc.gpa === p!.gpa && sc.total === p!.total) ? ranks[p!.sid] : i + 1; });
  return ranks;
}
function calcYearSummary(studentId: string, subjects: any[], allResults: any[]) {
  const res = allResults.filter((r: any) => r.studentId === studentId);
  const t3 = res.find((x: any) => x.term === '3');
  const hasT3 = t3 && subjects.some(s => t3.marks?.[s.name] !== undefined && t3.marks?.[s.name] !== null);
  if (!hasT3) return { finalGPA: null, avgTotalMarks: 0 };
  const ss = subjects.map(sub => { const ms = ['1', '2', '3'].map(t => { const r = res.find((x: any) => x.term === t); const m = r?.marks?.[sub.name]; return (m !== undefined && m !== null) ? +m : null; }).filter(m => m !== null) as number[]; const avg = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null; const g = avg !== null ? gradeFromMarks(avg, sub.fullMarks) : null; return { avg, gpa: g?.gpa ?? null }; }).filter(x => x.gpa !== null);
  if (!ss.length) return { finalGPA: null, avgTotalMarks: 0 };
  return { finalGPA: ss.reduce((a, x) => a + x.gpa!, 0) / ss.length, avgTotalMarks: ss.reduce((a, x) => a + x.avg!, 0) };
}
function calcYearRanks(clsStudents: any[], subjects: any[], allResults: any[]) {
  const scores = clsStudents.map(s => { const { finalGPA, avgTotalMarks } = calcYearSummary(s.id, subjects, allResults); return { sid: s.id, finalGPA, avgTotalMarks }; }).filter(x => x.finalGPA !== null);
  scores.sort((a, b) => b.finalGPA! - a.finalGPA! || b.avgTotalMarks - a.avgTotalMarks);
  const ranks: Record<string, number> = {};
  scores.forEach((sc, i) => { const p = scores[i - 1]; ranks[sc.sid] = (i > 0 && sc.finalGPA === p!.finalGPA && sc.avgTotalMarks === p!.avgTotalMarks) ? ranks[p!.sid] : i + 1; });
  return ranks;
}
function calcAttendPct(att: any) { return (!att?.days || att.days <= 0) ? '—' : ((att.present / att.days) * 100).toFixed(1) + '%'; }

// ── Shared: class dropdown ──
function ClassSelect({ value, onChange }: { value: string; onChange: (cls: any) => void }) {
  const { classes, fetchClasses } = useSchoolStore();
  useEffect(() => { fetchClasses(); }, []);
  const sorted = [...classes].sort((a, b) => a.order - b.order);
  return (
    <select value={value} onChange={(e) => { const cls = sorted.find((c: any) => c.id === e.target.value); if (cls) onChange(cls); }} className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent bg-white">
      <option value="">— Select Class —</option>
      {sorted.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

// ══════════════════════════════════════
//  TAB 1: ENTER BY SUBJECT
// ══════════════════════════════════════
function EnterBySubject() {
  const { students, fetchStudents, subjects, fetchSubjects, saveStudentResult } = useSchoolStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';
  const [cls, setCls] = useState<any>(null);
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkTerm, setBulkTerm] = useState('1');
  const [allResults, setAllResults] = useState<any[]>([]);
  const [bulkMarks, setBulkMarks] = useState<Record<string, string>>({});
  const [bulkAtt, setBulkAtt] = useState<Record<string, { days: string; present: string }>>({});
  const [bulkComment, setBulkComment] = useState<Record<string, string>>({});

  const loadResults = async (clsId: string) => {
    try { const res = await fetch(`${API_URL}/classes/${clsId}/results`, { credentials: 'include' }); setAllResults(await res.json()); } catch { setAllResults([]); }
  };

  const handleSelectClass = (c: any) => { setCls(c); setBulkSubject(''); fetchSubjects(c.id); loadResults(c.id); fetchStudents(); };

  const clsStudents = cls ? students.filter((s: any) => s.class === cls.name).sort((a: any, b: any) => (+a.roll || 999) - (+b.roll || 999) || a.name.localeCompare(b.name)) : [];
  const selectedSubj = subjects.find((s: any) => s.name === bulkSubject);
  const isAttendance = bulkSubject === '__attendance__';
  const isComment = bulkSubject === '__comment__';

  useEffect(() => {
    if (!bulkSubject || !cls) return;
    if (isAttendance) {
      const atts: Record<string, { days: string; present: string }> = {};
      clsStudents.forEach((s: any) => { const r = allResults.find((x: any) => x.studentId === s.id && x.term === bulkTerm); atts[s.id] = { days: String(r?.attendance?.days || ''), present: String(r?.attendance?.present || '') }; });
      setBulkAtt(atts);
    } else if (isComment) {
      const cmts: Record<string, string> = {};
      clsStudents.forEach((s: any) => { const r = allResults.find((x: any) => x.studentId === s.id && x.term === '3'); cmts[s.id] = r?.comment || ''; });
      setBulkComment(cmts);
    } else {
      const m: Record<string, string> = {};
      clsStudents.forEach((s: any) => { const r = allResults.find((x: any) => x.studentId === s.id && x.term === bulkTerm); m[s.id] = r?.marks?.[bulkSubject] !== undefined ? String(r.marks[bulkSubject]) : ''; });
      setBulkMarks(m);
    }
  }, [bulkSubject, bulkTerm, allResults.length, cls]);

  const saveBulkMarks = async () => {
    if (!selectedSubj) return;
    toast('Saving…', '');
    for (const s of clsStudents) {
      const v = bulkMarks[s.id];
      const marksData: Record<string, number> = {};
      const existing = allResults.find((x: any) => x.studentId === s.id && x.term === bulkTerm);
      if (existing?.marks) Object.entries(existing.marks).forEach(([k, val]) => { marksData[k] = +val; });
      if (v !== '' && v !== undefined && !isNaN(+v)) marksData[bulkSubject] = Math.min(+v, selectedSubj.fullMarks);
      else delete marksData[bulkSubject];
      await saveStudentResult(s.id, bulkTerm, marksData, existing?.attendance || { days: 0, present: 0 });
    }
    toast(`Marks saved for ${clsStudents.length} students ✓`, 'success');
    loadResults(cls.id);
  };

  const saveBulkAttendance = async () => {
    toast('Saving…', '');
    for (const s of clsStudents) {
      const att = bulkAtt[s.id] || { days: '', present: '' };
      const existing = allResults.find((x: any) => x.studentId === s.id && x.term === bulkTerm);
      await saveStudentResult(s.id, bulkTerm, existing?.marks || {}, { days: parseInt(att.days) || 0, present: parseInt(att.present) || 0 });
    }
    toast(`Attendance saved ✓`, 'success');
    loadResults(cls.id);
  };

  const saveBulkComments = async () => {
    toast('Saving…', '');
    for (const s of clsStudents) {
      const existing = allResults.find((x: any) => x.studentId === s.id && x.term === '3');
      await saveStudentResult(s.id, '3', existing?.marks || {}, existing?.attendance || { days: 0, present: 0 }, bulkComment[s.id] || '');
    }
    toast(`Comments saved ✓`, 'success');
    loadResults(cls.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]"><label className="text-xs text-school-muted mb-1 block">Class</label><ClassSelect value={cls?.id || ''} onChange={handleSelectClass} /></div>
        {cls && (
          <>
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-school-muted mb-1 block">Subject</label>
              <select value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)} className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent bg-white">
                <option value="">— Select —</option>
                {subjects.map((s: any) => <option key={s.id} value={s.name}>{s.name} (/{s.fullMarks})</option>)}
                <option value="__attendance__">📅 Attendance</option>
                <option value="__comment__">💬 Teacher's Comment</option>
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-school-muted mb-1 block">Term</label>
              <select value={bulkTerm} onChange={(e) => setBulkTerm(e.target.value)} className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent bg-white" disabled={bulkSubject === '__comment__'}>
                {['1', '2', '3'].map(t => <option key={t} value={t}>{TERM_NAMES[t]}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {!cls && <div className="text-center py-12 text-sm text-school-muted">Select a class to begin.</div>}
      {cls && !bulkSubject && <div className="text-center py-8 text-sm text-school-muted">Select a subject above to begin.</div>}
      {cls && bulkSubject && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-school-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-school-primary text-white text-xs uppercase">
                  <th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2 text-left">Roll</th>
                  {isComment ? <th className="px-3 py-2 text-left">Teacher's Comment</th> : isAttendance ? <>
                    <th className="px-3 py-2 text-center">Total Days</th><th className="px-3 py-2 text-center">Present</th><th className="px-3 py-2 text-center">%</th>
                  </> : <>
                    <th className="px-3 py-2 text-center">Full</th><th className="px-3 py-2 text-center">Marks</th><th className="px-3 py-2 text-center">Grade</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {clsStudents.map((s: any, i: number) => {
                  if (isComment) {
                    return <tr key={s.id} className={`border-t border-school-border/50 ${i % 2 ? 'bg-school-paper/30' : ''}`}>
                      <td className="px-3 py-2">{i + 1}</td><td className="px-3 py-2 font-medium">{s.name}</td><td className="px-3 py-2">{s.roll || '—'}</td>
                      <td className="px-3 py-2"><textarea value={bulkComment[s.id] || ''} onChange={(e) => setBulkComment({ ...bulkComment, [s.id]: e.target.value })} rows={2} className="w-full px-2 py-1 border border-school-border rounded text-xs focus:outline-none focus:border-school-accent resize-none" placeholder="Write about performance…" /></td>
                    </tr>;
                  }
                  if (isAttendance) {
                    const att = bulkAtt[s.id] || { days: '', present: '' };
                    const pct = att.days && parseInt(att.days) > 0 ? ((parseInt(att.present) || 0) / parseInt(att.days) * 100).toFixed(1) + '%' : '—';
                    return <tr key={s.id} className={`border-t border-school-border/50 ${i % 2 ? 'bg-school-paper/30' : ''}`}>
                      <td className="px-3 py-2">{i + 1}</td><td className="px-3 py-2 font-medium">{s.name}</td><td className="px-3 py-2">{s.roll || '—'}</td>
                      <td className="px-3 py-2 text-center"><input type="number" min="0" value={att.days} onChange={(e) => setBulkAtt({ ...bulkAtt, [s.id]: { ...att, days: e.target.value } })} className="w-16 px-2 py-1 border border-school-border rounded text-right text-xs focus:outline-none" /></td>
                      <td className="px-3 py-2 text-center"><input type="number" min="0" value={att.present} onChange={(e) => setBulkAtt({ ...bulkAtt, [s.id]: { ...att, present: e.target.value } })} className="w-16 px-2 py-1 border border-school-border rounded text-right text-xs focus:outline-none" /></td>
                      <td className="px-3 py-2 text-center text-xs font-bold">{pct}</td>
                    </tr>;
                  }
                  const v = bulkMarks[s.id] || '';
                  const g = v !== '' && !isNaN(+v) ? gradeFromMarks(+v, selectedSubj!.fullMarks) : null;
                  return <tr key={s.id} className={`border-t border-school-border/50 ${i % 2 ? 'bg-school-paper/30' : ''}`}>
                    <td className="px-3 py-2">{i + 1}</td><td className="px-3 py-2 font-medium">{s.name}</td><td className="px-3 py-2">{s.roll || '—'}</td>
                    <td className="px-3 py-2 text-center">{selectedSubj!.fullMarks}</td>
                    <td className="px-3 py-2 text-center"><input type="number" min="0" max={selectedSubj!.fullMarks} value={v} onChange={(e) => { setBulkMarks({ ...bulkMarks, [s.id]: e.target.value }); }} className={`w-16 px-2 py-1 border rounded text-right text-xs focus:outline-none ${!isNaN(parseFloat(v)) && parseFloat(v) > selectedSubj!.fullMarks ? 'border-red-500' : 'border-school-border'}`} /></td>
                    <td className="px-3 py-2 text-center">{g ? gradeChip(g.grade) : '—'}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {isAdmin && <button onClick={isComment ? saveBulkComments : isAttendance ? saveBulkAttendance : saveBulkMarks} className="w-full py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:opacity-90">
            💾 Save {isComment ? 'All Comments' : isAttendance ? `${TERM_NAMES[bulkTerm]} Attendance` : 'All Marks'}
          </button>}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
//  TAB 2: ENTER BY STUDENT
// ══════════════════════════════════════
function EnterByStudent() {
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
  }, [activeStudent, activeTerm, allResults]);

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
    await saveStudentResult(activeStudent.id, activeTerm, marksData, { days: parseInt(att.days) || 0, present: parseInt(att.present) || 0 }, cmt);
    loadResults(cls.id);
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
                    {s.photo ? <img src={s.photo} alt="" className="w-10 h-10 rounded-full object-cover border border-school-border" /> : <div className="w-10 h-10 rounded-full bg-school-primary text-white flex items-center justify-center text-sm">👤</div>}
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
            {activeStudent.photo ? <img src={activeStudent.photo} alt="" className="w-10 h-10 rounded-full object-cover border border-school-border" /> : <div className="w-10 h-10 rounded-full bg-school-primary text-white flex items-center justify-center text-sm">👤</div>}
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
            {isAdmin && <button onClick={() => save(marks, attendance, comment)} className="w-full mt-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:opacity-90">💾 Save Marks</button>}
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

// ══════════════════════════════════════
//  ONLINE REPORT CARD (HTML view)
// ══════════════════════════════════════
function OnlineReportCard({ student, cls, subjects, allResults, term, onBack }: { student: any; cls: any; subjects: any[]; allResults: any[]; term: string; onBack: () => void }) {
  const isFinal = term === 'final';
  const label = isFinal ? 'Annual Result' : TERM_NAMES[term];
  const clsStudents = useSchoolStore.getState().students.filter((s: any) => s.class === cls.name);
  const ranks = isFinal ? calcYearRanks(clsStudents, subjects, allResults) : calcTermRanks(clsStudents, term, subjects, allResults);
  const rank = ranks[student.id] || '—';

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

  let totObt = 0, totFull = 0, gpas: number[] = [], hasF = false;
  if (!isFinal) {
    subjects.forEach((sub: any) => {
      const m = res?.marks?.[sub.name];
      if (m !== undefined && m !== null) { const g = gradeFromMarks(+m, sub.fullMarks); gpas.push(g.gpa); if (g.grade === 'F') hasF = true; totObt += +m; totFull += sub.fullMarks; }
    });
  }
  const termGPA = gpas.length ? gpas.reduce((a, b) => a + b, 0) / gpas.length : null;
  const termGrade = hasF ? 'F' : termGPA !== null ? gpaToGrade(termGPA) : '—';
  const { finalGPA } = calcYearSummary(student.id, subjects, allResults);
  const finalGrade = finalGPA !== null ? gpaToGrade(finalGPA) : '—';
  const termRank = !isFinal ? (calcTermRanks(clsStudents, term, subjects, allResults)[student.id] || '—') : '—';
  const yearRank = ranks[student.id] || '—';

  let attRows: { term: string; days: number; present: number; pct: string }[] = [];
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
        <button onClick={() => downloadReportCardPDF(student, cls.name, subjects, allResults, term)} className="ml-auto flex items-center gap-1 px-4 py-2 bg-school-primary text-white rounded-xl text-xs font-bold hover:opacity-90"><Download size={14} /> Download PDF</button>
      </div>
        <div className="bg-white rounded-2xl border border-school-border max-w-2xl mx-auto space-y-5 p-6">
        <div className="text-center border-b border-school-border pb-4">
          <img src={SCHOOL_LOGO} alt="Logo" className="w-16 h-16 rounded-full object-cover mx-auto mb-2" />
          <h2 className="font-serif text-xl text-school-primary">AL RAWA English School</h2>
          <p className="text-[10px] text-school-muted mt-1">ESTD: 2022 · Read in the name of your Lord</p>
          <p className="text-sm font-bold text-red-600 mt-2">{isFinal ? 'ANNUAL REPORT CARD' : `TERM REPORT CARD — ${label.toUpperCase()}`}</p>
        </div>
        <div className="flex items-center gap-4">
          {student.photo ? <img src={student.photo} alt="" className="w-16 h-16 rounded-full object-cover border border-school-border" /> : <div className="w-16 h-16 rounded-full bg-school-primary text-white flex items-center justify-center text-2xl">👤</div>}
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
          <h4 className="font-bold text-sm mb-2">📅 Attendance</h4>
          <table className="w-full text-sm border border-school-border">
            <thead><tr className="bg-gray-100 text-xs uppercase"><th className="px-3 py-2 text-left">Term</th><th className="px-3 py-2 text-center">Days</th><th className="px-3 py-2 text-center">Present</th><th className="px-3 py-2 text-center">%</th></tr></thead>
            <tbody>{attRows.map((a, i) => <tr key={i} className="border-t border-school-border"><td className="px-3 py-2">{a.term}</td><td className="px-3 py-2 text-center">{a.days || '—'}</td><td className="px-3 py-2 text-center">{a.present || '—'}</td><td className="px-3 py-2 text-center font-bold">{a.pct}</td></tr>)}</tbody>
          </table>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-2">💬 Teacher's Comment</h4>
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

// ══════════════════════════════════════
//  TAB 3: TABULATION
// ══════════════════════════════════════
function TabulationPDF({ clsName, subjects, clsStudents, allResults, term }: { clsName: string; subjects: any[]; clsStudents: any[]; allResults: any[]; term: string }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210, M = 10, CW = 277;
  if (!clsStudents.length) { toast('No students', 'error'); return; }

  const isFinal = term === 'final';
  const tLabel = isFinal ? 'Annual Combined' : TERM_NAMES[term];
  const NAVY = [26, 26, 46], GREEN = [45, 106, 79], WHITE = [255, 255, 255], MUTED = [140, 134, 124];
  const ROW1 = [255, 253, 247], ROW2 = [244, 239, 230];
  const NAME_W = 40;
  const SUM_COLS: [string, number][] = [['Total', 16], ['GPA', 14], ['Grade', 14], ['Rank', 12]];
  const SUM_W = 56;
  const n = subjects.length;
  const SW = Math.max(14, Math.min(28, Math.floor((CW - NAME_W - SUM_W) / Math.max(n, 1))));
  const HH = 12, RH = 14;

  const allRanks = isFinal ? calcYearRanks(clsStudents, subjects, allResults) : calcTermRanks(clsStudents, term, subjects, allResults);

  function drawHeader() {
    let y = M;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY);
    doc.text(`${clsName}  —  Tabulation Sheet  (${tLabel})`, W / 2, y + 6, { align: 'center' });
    y += 13;
    doc.setFillColor(...NAVY); doc.rect(M, y, NAME_W, HH, 'F');
    let ax = M + NAME_W;
    subjects.forEach(() => { doc.setFillColor(...NAVY); doc.rect(ax, y, SW, HH, 'F'); ax += SW; });
    SUM_COLS.forEach(([, w]) => { doc.setFillColor(...(isFinal ? GREEN : NAVY)); doc.rect(ax, y, w, HH, 'F'); ax += w; });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...WHITE);
    doc.text('Student Name', M + 3, y + HH / 2 + 1);
    ax = M + NAME_W;
    subjects.forEach((subj) => {
      doc.setFontSize(6); let nm = subj.name;
      while (doc.getTextWidth(nm) > SW - 2 && nm.length > 2) nm = nm.slice(0, -1);
      doc.text(nm, ax + (SW - doc.getTextWidth(nm)) / 2, y + 4.5);
      doc.setFontSize(5.5); const fm = `(${subj.fullMarks})`;
      doc.text(fm, ax + (SW - doc.getTextWidth(fm)) / 2, y + 9.5);
      ax += SW;
    });
    SUM_COLS.forEach(([h, w]) => { doc.setFontSize(7); doc.text(h, ax + (w - doc.getTextWidth(h)) / 2, y + HH / 2 + 1); ax += w; });
    return y + HH;
  }

  let y = drawHeader();

  clsStudents.forEach((s, ri) => {
    if (y + RH > H - M) { doc.addPage(); y = drawHeader(); }
    const studentResults = allResults.filter((x: any) => x.studentId === s.id);
    const bg = ri % 2 === 0 ? ROW1 : ROW2;
    let ax = M;
    doc.setFillColor(...bg);
    doc.rect(ax, y, NAME_W, RH, 'F'); ax += NAME_W;
    subjects.forEach(() => { doc.rect(ax, y, SW, RH, 'F'); ax += SW; });
    SUM_COLS.forEach(([, w]) => { doc.rect(ax, y, w, RH, 'F'); ax += w; });
    doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    let nm = s.name;
    while (doc.getTextWidth(nm) > NAME_W - 4 && nm.length > 2) nm = nm.slice(0, -1);
    doc.text(nm, M + 3, y + RH / 2 + 0.8);
    ax = M + NAME_W;
    let totObt = 0, gpas: number[] = [], hasF = false;
    subjects.forEach((subj) => {
      let obt: number | null = null, g: any = null;
      if (isFinal) {
        const ms = ['1', '2', '3'].map(t => { const r = studentResults.find((x: any) => x.term === t); const v = r?.marks?.[subj.name]; return (v !== undefined && v !== null) ? +v : null; }).filter(v => v !== null) as number[];
        if (ms.length) { obt = ms.reduce((a, b) => a + b, 0) / ms.length; g = gradeFromMarks(obt, subj.fullMarks); }
      } else {
        const r = studentResults.find((x: any) => x.term === term);
        const v = r?.marks?.[subj.name];
        if (v !== undefined && v !== null) { obt = +v; g = gradeFromMarks(obt, subj.fullMarks); }
      }
      if (obt !== null && g) { totObt += obt; gpas.push(g.gpa); if (g.grade === 'F') hasF = true;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...NAVY);
        const ms = isFinal ? obt.toFixed(1) : String(obt);
        doc.text(ms, ax + (SW - doc.getTextWidth(ms)) / 2, y + 5.5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(70, 70, 110);
        const chip = `(${g.grade}, ${g.gpa.toFixed(2)})`;
        doc.text(chip, ax + (SW - doc.getTextWidth(chip)) / 2, y + 10.5);
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text('—', ax + (SW - doc.getTextWidth('—')) / 2, y + RH / 2 + 0.8);
      }
      doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.2); doc.rect(ax, y, SW, RH, 'S');
      ax += SW;
    });
    const tGPA = gpas.length ? gpas.reduce((a, b) => a + b, 0) / gpas.length : null;
    const tGrade = tGPA !== null ? (hasF ? 'F' : gpaToGrade(tGPA)) : '—';
    const tRank = allRanks[s.id] || '—';
    const sVals = [gpas.length ? totObt.toFixed(1) : '—', tGPA !== null ? tGPA.toFixed(2) : '—', tGrade, String(tRank)];
    SUM_COLS.forEach(([, w], si) => {
      doc.setFont('helvetica', si === 2 ? 'bold' : 'normal'); doc.setFontSize(7.5); doc.setTextColor(...NAVY);
      const sv = sVals[si]; doc.text(sv, ax + (w - doc.getTextWidth(sv)) / 2, y + RH / 2 + 0.8);
      doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.2); doc.rect(ax, y, w, RH, 'S'); ax += w;
    });
    doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.2); doc.rect(M, y, NAME_W, RH, 'S');
    y += RH;
  });

  doc.save(`${clsName.replace(/\s+/g, '_')}_Tabulation_${tLabel.replace(/\s+/g, '_')}.pdf`);
}

function TabulationTab() {
  const { students, fetchStudents, subjects, fetchSubjects } = useSchoolStore();
  const [cls, setCls] = useState<any>(null);
  const [allResults, setAllResults] = useState<any[]>([]);

  const loadResults = async (clsId: string) => {
    try { const res = await fetch(`${API_URL}/classes/${clsId}/results`, { credentials: 'include' }); setAllResults(await res.json()); } catch { setAllResults([]); }
  };

  const handleSelectClass = (c: any) => { setCls(c); fetchSubjects(c.id); fetchStudents(); loadResults(c.id); };
  const clsStudents = cls ? students.filter((s: any) => s.class === cls.name).sort((a: any, b: any) => (+a.roll || 999) - (+b.roll || 999) || a.name.localeCompare(b.name)) : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]"><label className="text-xs text-school-muted mb-1 block">Class</label><ClassSelect value={cls?.id || ''} onChange={handleSelectClass} /></div>
      </div>
      {!cls && <div className="text-center py-12 text-sm text-school-muted">Select a class to download tabulation sheets.</div>}
      {cls && (
        <div className="bg-white rounded-2xl border border-school-border p-6 space-y-4">
          <h4 className="font-serif text-lg text-school-primary">📋 Tabulation Sheet</h4>
          <p className="text-sm text-school-muted">Download a marks grid for {cls.name}. "Final Combined" only available after Term 3 is entered.</p>
          <div className="flex gap-3 flex-wrap">
            {['1', '2', '3'].map(t => (
              <button key={t} onClick={() => TabulationPDF({ clsName: cls.name, subjects, clsStudents, allResults, term: t })} className="px-4 py-2 border border-school-border rounded-xl text-sm font-bold hover:border-school-accent transition-all">⬇ {TERM_NAMES[t]}</button>
            ))}
            <button onClick={() => TabulationPDF({ clsName: cls.name, subjects, clsStudents, allResults, term: 'final' })} className="px-4 py-2 bg-school-primary text-white rounded-xl text-sm font-bold hover:opacity-90">⬇ Final Combined</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
//  TAB 4: ALL REPORT CARDS
// ══════════════════════════════════════
// ── PDF grade chip helper ──
function _pdfGradeChip(doc: jsPDF, cx: number, cy: number, grade: string) {
  const map: Record<string, [number[], number[]]> = {
    'A+': [[209, 250, 229], [6, 95, 70]], 'A': [[220, 252, 231], [22, 101, 52]],
    'A-': [[209, 250, 229], [21, 128, 61]], 'B+': [[219, 234, 254], [30, 64, 175]],
    'B': [[239, 246, 255], [29, 78, 216]], 'B-': [[240, 249, 255], [3, 105, 161]],
    'C+': [[254, 249, 195], [133, 77, 14]], 'C': [[254, 252, 232], [161, 98, 7]],
    'D': [[255, 237, 213], [194, 65, 12]], 'F': [[254, 226, 226], [185, 28, 28]],
  };
  const [bg, fg] = map[grade] || [[243, 244, 246], [107, 114, 128]];
  doc.setFillColor(...bg);
  doc.roundedRect(cx - 9, cy - 3, 18, 6, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.setTextColor(...fg);
  doc.text(grade, cx, cy + 0.8, { align: 'center' });
  doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'normal');
}

function downloadReportCardPDF(student: any, clsName: string, subjects: any[], allResults: any[], term: string, sharedDoc?: jsPDF) {
  const doc = sharedDoc || new jsPDF({ format: 'a4', unit: 'mm' });
  if (sharedDoc) doc.addPage();
  const W = 210, M = 12, CW = W - M * 2;
  const NAVY = [26, 26, 46], GREEN = [45, 106, 79], RED = [200, 75, 49], WHITE = [255, 255, 255], MUTED = [130, 124, 114], ROW1 = [255, 253, 247], ROW2 = [244, 239, 230];
  const isFinal = term === 'final';
  const label = isFinal ? 'Annual Result' : TERM_NAMES[term];
  const clsStudents = useSchoolStore.getState().students.filter((s: any) => s.class === clsName);
  const ranks = isFinal ? calcYearRanks(clsStudents, subjects, allResults) : calcTermRanks(clsStudents, term, subjects, allResults);
  const rank = ranks[student.id] || '—';
  const res = allResults.find((r: any) => r.studentId === student.id && r.term === (isFinal ? '3' : term));

  let y = 10;

  // HEADER with logo
  try {
    const logoEl = document.getElementById('school-logo') as HTMLImageElement;
    if (logoEl?.src) doc.addImage(logoEl.src, 'JPEG', M, y, 22, 22);
  } catch (_e) {}
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...NAVY);
  doc.text('AL RAWA English School', M + 26, y + 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
  doc.text('ESTD: 2022  ·  Read in the name of your Lord', M + 26, y + 16);
  const badge = isFinal ? 'ANNUAL REPORT CARD — ANNUAL RESULT' : `TERM REPORT CARD — ${label.toUpperCase()}`;
  const bw = doc.getTextWidth(badge) + 14;
  doc.setFillColor(...RED); doc.roundedRect(M + 26, y + 19, bw, 6.5, 3.25, 3.25, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...WHITE);
  doc.text(badge, M + 26 + bw / 2, y + 23.5, { align: 'center' });
  y += 30;

  // STUDENT INFO
  if (student.photo) { try { doc.addImage(student.photo, 'JPEG', W - M - 26, y, 26, 30, '', 'FAST'); } catch (_e) {} }
  doc.setFontSize(9.5);
  const infoRows: [string, string][] = [['Student Name', student.name], ['Class', clsName]];
  if (student.roll) infoRows.push(['Roll No.', student.roll]);
  if (student.fatherName) infoRows.push(["Father's Name", student.fatherName]);
  if (student.motherName) infoRows.push(["Mother's Name", student.motherName]);
  infoRows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(k, M, y + 5.5);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY); doc.text(v, M + 36, y + 5.5);
    y += 7;
  });
  y = Math.max(y, 72);

  // Divider
  doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 6;

  // SECTION TITLE
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
  doc.text(isFinal ? 'ANNUAL ACADEMIC RESULT' : `${label.toUpperCase()} — ACADEMIC RESULT`, M, y); y += 5;

  if (!isFinal) {
    // Single term table: Subject (Full Marks) | Marks Obtained | Grade | GPA
    const C = { s: { x: M, w: 78 }, mo: { x: M + 78, w: 52 }, gr: { x: M + 130, w: 30 }, gp: { x: M + 160, w: 26 } };
    const TW = CW, HH = 8, RH = 9;

    doc.setFillColor(...NAVY); doc.rect(M, y, TW, HH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
    doc.text('Subject (Full Marks)', C.s.x + 4, y + HH / 2 + 1);
    doc.text('Marks Obtained', C.mo.x + C.mo.w / 2, y + HH / 2 + 1, { align: 'center' });
    doc.text('Grade', C.gr.x + C.gr.w / 2, y + HH / 2 + 1, { align: 'center' });
    doc.text('GPA', C.gp.x + C.gp.w / 2, y + HH / 2 + 1, { align: 'center' });
    y += HH;

    const tm = res?.marks || {};
    let totObt = 0, totFull = 0, gpas: number[] = [], hasF = false;

    subjects.forEach((subj, ri) => {
      if (y > 248) { doc.addPage(); y = 14; }
      const m = tm[subj.name];
      const obt = (m !== undefined && m !== null) ? +m : null;
      const g = obt !== null ? gradeFromMarks(obt, subj.fullMarks) : null;
      if (g) { gpas.push(g.gpa); if (g.grade === 'F') hasF = true; totObt += obt; totFull += subj.fullMarks; }

      doc.setFillColor(...(ri % 2 === 0 ? ROW1 : ROW2)); doc.rect(M, y, TW, RH, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...NAVY);
      let nm = subj.name;
      while (doc.getTextWidth(nm) > C.s.w - 6 && nm.length > 2) nm = nm.slice(0, -1);
      doc.text(nm, C.s.x + 4, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
      doc.text(`(${subj.fullMarks} marks)`, C.s.x + 4, y + 7.8);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
      if (obt !== null) doc.text(String(obt), C.mo.x + C.mo.w / 2, y + 6, { align: 'center' });
      else { doc.setTextColor(...MUTED); doc.text('—', C.mo.x + C.mo.w / 2, y + 6, { align: 'center' }); doc.setTextColor(...NAVY); }

      if (g) _pdfGradeChip(doc, C.gr.x + C.gr.w / 2, y + RH / 2, g.grade);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
      if (g) doc.text(g.gpa.toFixed(2), C.gp.x + C.gp.w / 2, y + 6, { align: 'center' });

      doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.15); doc.line(M, y + RH, M + TW, y + RH); y += RH;
    });

    if (gpas.length) {
      doc.setFillColor(...NAVY); doc.rect(M, y, TW, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
      doc.text('TOTAL', C.s.x + 4, y + 4.5);
      doc.text(`${totObt} / ${totFull}`, C.mo.x + C.mo.w / 2, y + 4.5, { align: 'center' });
      y += 7;
    }
    y += 6;

    // Result summary bar (navy)
    if (gpas.length) {
      if (y > 248) { doc.addPage(); y = 14; }
      const tGPA = gpas.reduce((a, b) => a + b, 0) / gpas.length;
      const tGr = hasF ? 'F' : gpaToGrade(tGPA);
      const BH = 22;
      doc.setFillColor(...NAVY); doc.rect(M, y, CW, BH, 'F');
      const sw = CW / 3;
      [[`${label.toUpperCase()} GPA`, tGPA.toFixed(2)], ['GRADE', tGr], ['CLASS RANK', String(rank)]].forEach(([lbl, val], i) => {
        const cx = M + i * sw + sw / 2;
        if (i > 0) { doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3); doc.line(M + i * sw, y + 4, M + i * sw, y + BH - 4); }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(160, 155, 145);
        doc.text(lbl, cx, y + 7, { align: 'center' });
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...WHITE);
        doc.text(val, cx, y + 18, { align: 'center' });
      });
      y += BH + 8;
    }
  } else {
    // Annual table: Subject | 1st | 2nd | Final | Average | Grade | GPA
    const C = { s: { x: M, w: 50 }, t1: { x: M + 50, w: 22 }, t2: { x: M + 72, w: 22 }, t3: { x: M + 94, w: 22 }, avg: { x: M + 116, w: 22 }, gr: { x: M + 138, w: 26 }, gp: { x: M + 164, w: 22 } };
    const TW = CW, H1 = 8, H2 = 7, RH = 8;

    // Header row 1
    doc.setFillColor(...NAVY);
    doc.rect(C.s.x, y, C.s.w, H1 + H2, 'F');
    doc.rect(C.t1.x, y, C.t1.w + C.t2.w + C.t3.w, H1, 'F');
    doc.setFillColor(...GREEN);
    doc.rect(C.avg.x, y, C.avg.w + C.gr.w + C.gp.w, H1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
    doc.text('Subject', C.s.x + C.s.w / 2, y + H1 / 2 + 0.5, { align: 'center' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('(Full Marks)', C.s.x + C.s.w / 2, y + H1 / 2 + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Term Marks', C.t1.x + (C.t1.w + C.t2.w + C.t3.w) / 2, y + H1 / 2 + 1, { align: 'center' });
    doc.text('Annual Result', C.avg.x + (C.avg.w + C.gr.w + C.gp.w) / 2, y + H1 / 2 + 1, { align: 'center' });
    y += H1;

    // Header row 2
    doc.setFillColor(38, 38, 60);
    [C.t1, C.t2, C.t3, C.avg].forEach(col => doc.rect(col.x, y, col.w, H2, 'F'));
    doc.setFillColor(36, 84, 62);
    [C.gr, C.gp].forEach(col => doc.rect(col.x, y, col.w, H2, 'F'));
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...WHITE);
    [['1st Term', C.t1], ['2nd Term', C.t2], ['Final Exam', C.t3], ['Average', C.avg], ['Grade', C.gr], ['GPA', C.gp]].forEach(([lbl, col]) => {
      doc.text(lbl, col.x + col.w / 2, y + H2 / 2 + 0.8, { align: 'center' });
    });
    y += H2;

    // Data rows
    subjects.forEach((subj, ri) => {
      if (y > 248) { doc.addPage(); y = 14; }
      const getM = (t: string) => { const r = allResults.find((x: any) => x.studentId === student.id && x.term === t); const v = r?.marks?.[subj.name]; return (v !== undefined && v !== null) ? +v : null; };
      const m1 = getM('1'), m2 = getM('2'), m3 = getM('3');
      const vals = [m1, m2, m3].filter(m => m !== null) as number[];
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      const gAvg = avg !== null ? gradeFromMarks(avg, subj.fullMarks) : null;

      doc.setFillColor(...(ri % 2 === 0 ? ROW1 : ROW2)); doc.rect(M, y, TW, RH, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
      let nm = subj.name;
      while (doc.getTextWidth(nm) > C.s.w - 5 && nm.length > 2) nm = nm.slice(0, -1);
      doc.text(nm, C.s.x + 3, y + 3.8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
      doc.text(`(${subj.fullMarks})`, C.s.x + 3, y + 7.2);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...NAVY);
      [[m1, C.t1], [m2, C.t2], [m3, C.t3]].forEach(([m, col]) => {
        if (m !== null) doc.text(String(m), col.x + col.w / 2, y + 5.5, { align: 'center' });
        else { doc.setTextColor(...MUTED); doc.text('—', col.x + col.w / 2, y + 5.5, { align: 'center' }); doc.setTextColor(...NAVY); }
      });
      if (avg !== null) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...NAVY); doc.text(avg.toFixed(1), C.avg.x + C.avg.w / 2, y + 5.5, { align: 'center' }); }
      if (gAvg) _pdfGradeChip(doc, C.gr.x + C.gr.w / 2, y + RH / 2, gAvg.grade);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...NAVY);
      if (gAvg) doc.text(gAvg.gpa.toFixed(2), C.gp.x + C.gp.w / 2, y + 5.5, { align: 'center' });
      doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.15); doc.line(M, y + RH, M + TW, y + RH); y += RH;
    });
    y += 6;

    // Annual result bar
    const { finalGPA } = calcYearSummary(student.id, subjects, allResults);
    const finalGrade = finalGPA !== null ? gpaToGrade(finalGPA) : '—';
    if (y > 248) { doc.addPage(); y = 14; }
    const BH = 22;
    doc.setFillColor(...NAVY); doc.rect(M, y, CW, BH, 'F');
    const sw = CW / 3;
    [['ANNUAL GPA', finalGPA !== null ? finalGPA.toFixed(2) : '—'], ['FINAL GRADE', finalGrade], ['YEAR RANK', String(rank)]].forEach(([lbl, val], i) => {
      const cx = M + i * sw + sw / 2;
      if (i > 0) { doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3); doc.line(M + i * sw, y + 4, M + i * sw, y + BH - 4); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(160, 155, 145);
      doc.text(lbl, cx, y + 7, { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...WHITE);
      doc.text(val, cx, y + 18, { align: 'center' });
    });
    y += BH + 8;
  }

  // ATTENDANCE + COMMENT (side by side)
  const GAP = 8;
  const COLW = (CW - GAP) / 2;
  const attX = M, cmtX = M + COLW + GAP;
  const topY = y;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
  doc.text(isFinal ? 'ATTENDANCE SUMMARY' : `ATTENDANCE — ${label.toUpperCase()}`, attX, y + 4.5);
  doc.text("TEACHER'S COMMENT", cmtX, y + 4.5);
  y += 8;

  const attStartY = y;
  if (!isFinal) {
    const att = res?.attendance;
    [['Total School Days', att?.days || '—'], ['Days Present', att?.present || '—'], ['Attendance', calcAttendPct(att)]].forEach(([k, v]) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(k, attX + 2, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...NAVY); doc.text(String(v), attX + COLW - 2, y + 4, { align: 'right' });
      y += 6.5;
    });
  } else {
    const aC = [31, 22, 18, 18]; const AH = 6;
    let ax = attX;
    doc.setFillColor(26, 26, 46); aC.forEach(w => { doc.rect(ax, y, w, AH, 'F'); ax += w; });
    ax = attX;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
    ['Term', 'Total Days', 'Present', 'Att%'].forEach((h, i) => {
      doc.setTextColor(255, 255, 255);
      const tw = doc.getTextWidth(h); const tx = i === 0 ? ax + 2 : ax + (aC[i] - tw) / 2;
      doc.text(h, tx, y + AH / 2 + 0.8); ax += aC[i];
    });
    y += AH;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    ['1', '2', '3'].forEach((t, ri) => {
      const att = allResults.find((x: any) => x.studentId === student.id && x.term === t)?.attendance;
      const vals = [TERM_NAMES[t], att?.days || '—', att?.present || '—', calcAttendPct(att)];
      ax = attX;
      doc.setFillColor(...(ri % 2 === 0 ? ROW1 : ROW2)); aC.forEach(w => { doc.rect(ax, y, w, AH, 'F'); ax += w; });
      ax = attX;
      vals.forEach((v, i) => {
        doc.setTextColor(26, 26, 46);
        const tw = doc.getTextWidth(String(v)); const tx = i === 0 ? ax + 2 : ax + (aC[i] - tw) / 2;
        doc.text(String(v), tx, y + AH / 2 + 0.8); ax += aC[i];
      });
      doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.15); doc.line(attX, y + AH, attX + aC.reduce((a, b) => a + b, 0), y + AH); y += AH;
    });
  }
  const attEndY = y;

  // Comment box
  const boxH = Math.max(attEndY - attStartY, 20);
  const comment = res?.comment || '';
  doc.setFillColor(250, 248, 243); doc.setDrawColor(210, 205, 195); doc.setLineWidth(0.3);
  doc.roundedRect(cmtX, attStartY, COLW, boxH, 2, 2, 'FD');
  const cmtLines = doc.splitTextToSize(comment || 'No comment added.', COLW - 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.setTextColor(!comment ? MUTED[0] : NAVY[0], !comment ? MUTED[1] : NAVY[1], !comment ? MUTED[2] : NAVY[2]);
  doc.text(cmtLines, cmtX + 4, attStartY + 5);

  y = attEndY + 8;

  // SIGNATURES — near page bottom
  const sigY = Math.max(y, 270);
  const sigW = (CW - 20) / 3;
  doc.setDrawColor(100, 100, 100); doc.setLineWidth(0.5);
  ['CLASS TEACHER', 'CO-ORDINATOR', 'PRINCIPAL'].forEach((lbl, i) => {
    const sx = M + i * (sigW + 10);
    doc.line(sx, sigY, sx + sigW, sigY);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
    doc.text(lbl, sx + sigW / 2, sigY + 5.5, { align: 'center' });
  });

  if (!sharedDoc) doc.save(`${student.name.replace(/\s+/g, '_')}_${isFinal ? 'Annual' : label.replace(/ /g, '_')}_Report.pdf`);
}

function AllReportCardsTab() {
  const { students, fetchStudents, subjects, fetchSubjects } = useSchoolStore();
  const [cls, setCls] = useState<any>(null);
  const [allResults, setAllResults] = useState<any[]>([]);

  const loadResults = async (clsId: string) => {
    try { const res = await fetch(`${API_URL}/classes/${clsId}/results`, { credentials: 'include' }); setAllResults(await res.json()); } catch { setAllResults([]); }
  };

  const handleSelectClass = (c: any) => { setCls(c); fetchSubjects(c.id); fetchStudents(); loadResults(c.id); };
  const clsStudents = cls ? students.filter((s: any) => s.class === cls.name).sort((a: any, b: any) => (+a.roll || 999) - (+b.roll || 999) || a.name.localeCompare(b.name)) : [];

  const downloadAll = (term: string) => {
    if (!clsStudents.length) { toast('No students', 'error'); return; }
    toast(`Generating ${clsStudents.length} report cards…`, '');
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    clsStudents.forEach((s, i) => { downloadReportCardPDF(s, cls.name, subjects, allResults, term, doc); });
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
          <h4 className="font-serif text-lg text-school-primary">📑 Download All Report Cards</h4>
          <p className="text-sm text-school-muted">Generate report cards for all {clsStudents.length} students in {cls.name}:</p>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => downloadAll('1')} className="px-4 py-2 border border-school-border rounded-xl text-sm font-bold hover:border-school-accent transition-all">📝 1st Term</button>
            <button onClick={() => downloadAll('2')} className="px-4 py-2 border border-school-border rounded-xl text-sm font-bold hover:border-school-accent transition-all">📝 2nd Term</button>
            <button onClick={() => downloadAll('final')} className="px-4 py-2 bg-school-primary text-white rounded-xl text-sm font-bold hover:opacity-90">🏆 Annual Result</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
//  MAIN RESULT SECTION (4 tabs)
// ══════════════════════════════════════
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
      {/* Tab Bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === t.key ? 'bg-school-primary text-white shadow-lg' : 'bg-white border border-school-border hover:border-school-accent'}`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'subject' && <EnterBySubject />}
      {activeTab === 'student' && <EnterByStudent />}
      {activeTab === 'tabulation' && <TabulationTab />}
      {activeTab === 'reports' && <AllReportCardsTab />}
    </div>
  );
};

export default ResultSection;
